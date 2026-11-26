import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api, ErrorApi } from "../api";
import { Cabecera } from "../Cabecera";
import type { Rol } from "../Cabecera";
import { descartarPendiente, EVENTO, guardarPendiente, listarPendientes, nuevoId, sincronizar } from "../offline";
import type { Pendiente } from "../offline";
import type { CapturaPayload, Razon, Semaforo, Variable } from "../tipos";
import { Avisos, BarraProbabilidad, Boton, Cargando, ErrorCaja, InsigniaDemo, InsigniaSemaforo, ListaRazones, Marcador, Vacio } from "../ui";
import { SEMAFORO, fechaHora, fechaRelativa, fraseProbabilidad, leerNumero, num, pct } from "../util";

// ------------------------------------------------------------------ conexión
function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);
  return enLinea;
}

function usePendientes() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const recargar = useCallback(() => {
    listarPendientes().then(setPendientes).catch(() => setPendientes([]));
  }, []);
  useEffect(() => {
    recargar();
    window.addEventListener(EVENTO, recargar);
    return () => window.removeEventListener(EVENTO, recargar);
  }, [recargar]);
  return pendientes;
}

function BannerConexion({ enLinea, pendientes }: { enLinea: boolean; pendientes: Pendiente[] }) {
  const [enviando, setEnviando] = useState(false);
  const porEnviar = pendientes.filter((p) => !p.error);

  // Sincroniza al volver la red y, mientras haya pendientes, cada 20 segundos.
  useEffect(() => {
    if (!enLinea || porEnviar.length === 0) return;
    sincronizar();
    const t = setInterval(() => sincronizar(), 20000);
    return () => clearInterval(t);
  }, [enLinea, porEnviar.length]);

  if (!enLinea) {
    return (
      <div role="status" className="border-l-2 border-ambar bg-superficie px-4 py-3 text-sm">
        <p className="font-medium">Sin conexión</p>
        <p className="text-suave">
          Se puede seguir capturando: cada lote se guarda en el teléfono y se envía solo al volver la red.
          {porEnviar.length > 0 && ` Pendientes: ${porEnviar.length}.`}
        </p>
      </div>
    );
  }
  if (porEnviar.length > 0) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 border border-linea bg-superficie px-4 py-3 text-sm">
        <p>
          <strong className="font-medium tabular">{porEnviar.length}</strong> {porEnviar.length === 1 ? "captura espera" : "capturas esperan"} conexión para enviarse.
        </p>
        <Boton
          variante="secundario"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            await sincronizar();
            setEnviando(false);
          }}
        >
          {enviando ? "Enviando…" : "Enviar ahora"}
        </Boton>
      </div>
    );
  }
  return null;
}

// --------------------------------------------------------------- captura
const GRUPOS: { titulo: string; claves: string[] }[] = [
  { titulo: "Lo básico", claves: ["density", "alcohol", "pH"] },
  { titulo: "Acidez", claves: ["fixed_acidity", "volatile_acidity", "citric_acid"] },
  { titulo: "Azúcar, sal y sulfatos", claves: ["residual_sugar", "chlorides", "sulphates"] },
  { titulo: "Azufre", claves: ["free_sulfur_dioxide", "total_sulfur_dioxide"] },
];

function agrupar(variables: Variable[]) {
  const usadas = new Set(GRUPOS.flatMap((g) => g.claves));
  const grupos = GRUPOS.map((g) => ({
    titulo: g.titulo,
    vars: g.claves.map((c) => variables.find((v) => v.clave === c)).filter((v): v is Variable => !!v),
  })).filter((g) => g.vars.length > 0);
  const otras = variables.filter((v) => !usadas.has(v.clave));
  if (otras.length) grupos.push({ titulo: "Otros análisis", vars: otras });
  return grupos;
}

const fueraDeRango = (v: number, x: Variable) => v < x.rango_normal[0] || v > x.rango_normal[1];

type Vista =
  | { tipo: "inicio" }
  | { tipo: "captura" }
  | { tipo: "resultado"; datos: DatosResultado }
  | { tipo: "pendiente"; p: Pendiente };

interface DatosResultado {
  codigo: string;
  tanque: string;
  probabilidad: number;
  semaforo: Semaforo;
  razones: Razon[];
  advertencias: string[];
  nota: string;
  extra?: string; // por ejemplo, la decisión de Sergio
  guardadoAhora: boolean;
}

/** Enter pasa al siguiente campo; en el último, guarda. Así se captura sin soltar el teclado. */
function alEnter(e: KeyboardEvent<HTMLInputElement>) {
  // Mientras un teclado de composición (dictado, acentos, IME) arma el texto, Enter confirma esa palabra.
  if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  const form = e.currentTarget.form;
  if (!form) return;
  const campos = Array.from(form.querySelectorAll<HTMLInputElement>("input:not([disabled])"));
  const i = campos.indexOf(e.currentTarget);
  if (i >= 0 && i < campos.length - 1) campos[i + 1].focus();
  else form.requestSubmit();
}

function Captura({
  variables, nombre, onCancelar, onEvaluado, onPendiente,
}: {
  variables: Variable[];
  nombre: string;
  onCancelar: () => void;
  onEvaluado: (d: DatosResultado) => void;
  onPendiente: (p: Pendiente) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [tanque, setTanque] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grupos = useMemo(() => agrupar(variables), [variables]);
  const ultimaClave = grupos.at(-1)?.vars.at(-1)?.clave;
  const primerCampo = useRef<HTMLInputElement>(null);

  useEffect(() => primerCampo.current?.focus(), []);

  const numeros = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const v of variables) out[v.clave] = leerNumero(textos[v.clave] ?? "");
    return out;
  }, [textos, variables]);

  const capturados = variables.filter((v) => numeros[v.clave] !== null).length;
  const faltan = (codigo.trim() === "" ? 1 : 0) + (variables.length - capturados);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntento(true);
    setError(null);
    if (faltan > 0) {
      // El foco va al primer campo vacío (se calcula aquí: los campos marcados todavía no se han vuelto a pintar).
      const primero = codigo.trim() === "" ? "codigo" : variables.find((v) => numeros[v.clave] === null)?.clave;
      if (primero) document.getElementById(primero)?.focus();
      return;
    }
    const payload = {
      codigo: codigo.trim(),
      tanque: tanque.trim(),
      capturado_por: nombre,
      id_cliente: nuevoId(),
      fecha: new Date().toISOString(),
      ...Object.fromEntries(variables.map((v) => [v.clave, numeros[v.clave] as number])),
    } as CapturaPayload;

    setEnviando(true);
    try {
      const r = await api.crearAnalisis(payload);
      onEvaluado({
        codigo: r.codigo, tanque: r.tanque, probabilidad: r.probabilidad, semaforo: r.semaforo,
        razones: r.razones, advertencias: r.advertencias, nota: r.nota, guardadoAhora: true,
      });
    } catch (err) {
      if (err instanceof ErrorApi) setError(`No se pudo guardar: ${err.message}`);
      else onPendiente(await guardarPendiente(payload)); // sin red: queda en el teléfono
    } finally {
      setEnviando(false);
    }
  };

  const total = variables.length;
  return (
    <form onSubmit={enviar} noValidate className="mx-auto max-w-xl px-4 pb-44 pt-3">
      <button type="button" onClick={onCancelar} className="-ml-3 min-h-10 px-3 text-sm text-suave hover:bg-realce hover:text-texto">
        <span aria-hidden>← </span>Cancelar captura
      </button>
      <h1 className="mt-3 text-xl font-medium">Lote nuevo</h1>

      <fieldset className="mt-6 space-y-5 border-t border-linea pt-4">
        <legend className="float-left mb-4 w-full text-base font-medium">Identificación</legend>
        <Campo id="codigo" ref={primerCampo} etiqueta="Código del lote" valor={codigo} onCambio={setCodigo} falta={intento && codigo.trim() === ""} texto placeholder="Ej. L-2026-014" />
        <Campo id="tanque" etiqueta="Tanque (opcional)" valor={tanque} onCambio={setTanque} texto placeholder="Ej. T-03" />
      </fieldset>

      {grupos.map((g) => (
        <fieldset key={g.titulo} className="mt-8 space-y-5 border-t border-linea pt-4">
          <legend className="float-left mb-4 w-full text-base font-medium">{g.titulo}</legend>
          {g.vars.map((v) => {
            const n = numeros[v.clave];
            return (
              <Campo
                key={v.clave}
                id={v.clave}
                etiqueta={v.nombre}
                unidad={v.unidad}
                ayuda={v.ayuda}
                normal={`Normal: ${num(v.rango_normal[0], v.decimales)} – ${num(v.rango_normal[1], v.decimales)}${v.unidad ? ` ${v.unidad}` : ""}`}
                valor={textos[v.clave] ?? ""}
                onCambio={(t) => setTextos((x) => ({ ...x, [v.clave]: t }))}
                falta={intento && n === null}
                ultimo={v.clave === ultimaClave}
                aviso={n !== null && fueraDeRango(n, v) ? "Se ve fuera de lo normal. Revisa que esté bien capturado." : undefined}
              />
            );
          })}
        </fieldset>
      ))}

      {error && <div className="mt-6"><ErrorCaja>{error}</ErrorCaja></div>}

      {/* Barra fija: avance y botón de guardar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linea bg-fondo px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="tabular">{capturados} de {total} análisis</span>
            {intento && faltan > 0 && <span className="font-medium text-rojo">Faltan {faltan}</span>}
          </div>
          <div className="mb-3 h-1 bg-linea" aria-hidden>
            <div className="h-full bg-texto transition-[width]" style={{ width: `${(capturados / total) * 100}%` }} />
          </div>
          <Boton type="submit" grande className="w-full" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar y evaluar"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

function Campo({
  id, etiqueta, valor, onCambio, unidad, ayuda, normal, aviso, falta, texto, placeholder, ultimo, ref,
}: {
  id: string; etiqueta: string; valor: string; onCambio: (t: string) => void;
  unidad?: string; ayuda?: string; normal?: string; aviso?: string; falta?: boolean; texto?: boolean; placeholder?: string;
  ultimo?: boolean; // en el último campo, Enter guarda: el teclado muestra "Listo" en vez de "Siguiente"
  ref?: React.Ref<HTMLInputElement>;
}) {
  const describe = [ayuda && `${id}-ayuda`, normal && `${id}-normal`, aviso && `${id}-aviso`].filter(Boolean).join(" ");
  return (
    <div className="clear-both">
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      {ayuda && <p id={`${id}-ayuda`} className="text-xs text-suave">{ayuda}</p>}
      <div className="relative mt-1.5">
        <input
          ref={ref}
          id={id}
          name={id}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={alEnter}
          type="text"
          inputMode={texto ? "text" : "decimal"}
          autoComplete="off"
          autoCapitalize={texto ? "characters" : "off"}
          enterKeyHint={ultimo ? "done" : "next"}
          placeholder={placeholder}
          aria-invalid={falta || undefined}
          aria-describedby={describe || undefined}
          className={`campo !min-h-14 text-lg ${unidad ? "!pr-20" : ""} ${aviso ? "campo-aviso" : ""}`}
        />
        {unidad && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-suave">
            {unidad}
          </span>
        )}
      </div>
      {normal && <p id={`${id}-normal`} className="mt-1 text-xs text-suave tabular">{normal}</p>}
      {falta && <p className="mt-1 text-sm font-medium text-rojo">Falta este dato.</p>}
      {aviso && (
        <p id={`${id}-aviso`} className="mt-1.5 border-l-2 border-ambar pl-3 text-sm">
          {aviso}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ resultado
function PantallaResultado({ d, onInicio, onNuevo }: { d: DatosResultado; onInicio: () => void; onNuevo: () => void }) {
  const [umbral, setUmbral] = useState<number | null>(null);
  useEffect(() => {
    api.configuracion().then((c) => setUmbral(c.umbral_activo)).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <p className="text-sm text-suave [overflow-wrap:anywhere]">
        Lote <span className="font-medium text-texto">{d.codigo}</span>
        {d.tanque && <>, tanque {d.tanque}</>}
      </p>

      <div className="mt-5 border-y border-linea py-6">
        <div className="flex items-end justify-between gap-4">
          <p className="text-2xl font-medium leading-none tabular">{pct(d.probabilidad)}</p>
          <InsigniaSemaforo semaforo={d.semaforo} tam={12} />
        </div>
        <div className="mt-4">
          <BarraProbabilidad p={d.probabilidad} semaforo={d.semaforo} umbral={umbral ?? 0.5} alto={8} />
        </div>
        <h1 className="mt-4 text-base font-medium">{SEMAFORO[d.semaforo].significado}</h1>
        <p className="mt-1 text-sm text-suave">{fraseProbabilidad(d.probabilidad)}</p>
        {umbral !== null && <p className="mt-1 text-xs text-suave">La línea marca la regla activa: Prometedor desde {pct(umbral)}.</p>}
      </div>

      <div className="mt-6 space-y-6">
        {d.extra && <p className="border-l-2 border-texto pl-3 text-sm">{d.extra}</p>}
        <Avisos avisos={d.advertencias} />
        <ListaRazones razones={d.razones} nota={d.nota} nivel={2} />
        <div className="space-y-2 pt-2">
          {d.guardadoAhora && (
            <Boton grande className="w-full" onClick={onNuevo}>
              Capturar otro lote
            </Boton>
          )}
          <Boton grande variante="secundario" className="w-full" onClick={onInicio}>
            Volver a mis lotes
          </Boton>
        </div>
      </div>
    </div>
  );
}

function PantallaPendiente({ p, onInicio, onNuevo }: { p: Pendiente; onInicio: () => void; onNuevo: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <p className="flex items-center gap-2 text-sm text-suave">
        <Marcador tipo="pendiente" tam={12} /> Sin conexión
      </p>
      <h1 className="mt-4 text-xl font-medium">Guardado en tu teléfono</h1>
      <p className="mt-3 text-base [overflow-wrap:anywhere]">
        El lote <strong className="font-medium">{p.payload.codigo}</strong> se enviará solo en cuanto vuelva la red. Su resultado aparecerá en la lista de lotes.
      </p>
      <div className="mt-8 space-y-2">
        <Boton grande className="w-full" onClick={onNuevo}>
          Capturar otro lote
        </Boton>
        <Boton grande variante="secundario" className="w-full" onClick={onInicio}>
          Volver a mis lotes
        </Boton>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- inicio
function Inicio({
  nombre, pendientes, enLinea, onCapturar, onAbrir,
}: {
  nombre: string;
  pendientes: Pendiente[];
  enLinea: boolean;
  onCapturar: () => void;
  onAbrir: (id: number) => void;
}) {
  const [lotes, setLotes] = useState<Awaited<ReturnType<typeof api.lotes>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    setError(false);
    api
      .lotes({ capturado_por: nombre, orden: "fecha" })
      .then((l) => vigente && setLotes(l))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [nombre, pendientes.length]);

  const hoy = lotes ? lotes.filter((l) => new Date(l.fecha).toDateString() === new Date().toDateString()).length : 0;

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-medium [overflow-wrap:anywhere]">Lotes de {nombre || "la enóloga"}</h1>
      <p className="mt-1 text-sm text-suave">
        {lotes === null ? " " : hoy > 0 ? `Hoy: ${hoy} ${hoy === 1 ? "lote capturado" : "lotes capturados"}.` : "Todavía no hay capturas hoy."}
      </p>

      <div className="mt-5 space-y-3">
        <BannerConexion enLinea={enLinea} pendientes={pendientes} />
        <Boton grande className="w-full" onClick={onCapturar}>
          Capturar lote nuevo
        </Boton>
      </div>

      <h2 className="mt-10 text-base font-medium">Recientes</h2>

      {pendientes.length > 0 && (
        <ul className="mt-2 divide-y divide-linea border-t border-linea">
          {pendientes.map((p) => (
            <li key={p.id_cliente} className="flex items-center gap-3 py-3">
              <Marcador tipo="pendiente" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.payload.codigo}</p>
                <p className="text-xs text-suave">{p.error ? `No se pudo enviar: ${p.error}` : "Esperando conexión para enviarse"}</p>
              </div>
              {p.error && (
                <Boton variante="fantasma" onClick={() => descartarPendiente(p.id_cliente)}>
                  Descartar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <div className="mt-3"><ErrorCaja>No se pudieron cargar los lotes. Revisa la conexión.</ErrorCaja></div>}
      {!lotes && !error && <Cargando />}
      {lotes && lotes.length === 0 && pendientes.length === 0 && (
        <div className="mt-3">
          <Vacio titulo="Aquí aparecerán los lotes capturados">Captura el primero con el botón de arriba; el resultado sale al instante.</Vacio>
        </div>
      )}
      {lotes && lotes.length > 0 && (
        <ul className={`divide-y divide-linea border-y border-linea ${pendientes.length ? "" : "mt-2"}`}>
          {lotes.slice(0, 15).map((l) => (
            <li key={l.id}>
              <button onClick={() => onAbrir(l.id)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-realce">
                {l.semaforo && <Marcador tipo={l.semaforo} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{l.codigo}</span>
                    {l.es_demo && <InsigniaDemo />}
                  </span>
                  <span className="block truncate text-xs text-suave">
                    {[l.tanque && `Tanque ${l.tanque}`, fechaRelativa(l.fecha)].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {l.probabilidad !== null && <span className="block font-medium tabular">{pct(l.probabilidad)}</span>}
                  {l.semaforo && <span className="block text-xs text-suave">{SEMAFORO[l.semaforo].etiqueta}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- la vista
export function VistaEnologa({
  variables, nombre, onNombre, rol, onRol,
}: {
  variables: Variable[] | null;
  nombre: string;
  onNombre: (n: string) => void;
  rol: Rol;
  onRol: (r: Rol) => void;
}) {
  const [vista, setVista] = useState<Vista>({ tipo: "inicio" });
  const [cargandoLote, setCargandoLote] = useState(false);
  const [errorLote, setErrorLote] = useState(false);
  const enLinea = useEnLinea();
  const pendientes = usePendientes();

  const ir = (v: Vista) => {
    setVista(v);
    window.scrollTo({ top: 0 });
  };

  const abrirLote = async (id: number) => {
    setCargandoLote(true);
    setErrorLote(false);
    try {
      const f = await api.lote(id);
      if (f.probabilidad === null || !f.semaforo) return;
      ir({
        tipo: "resultado",
        datos: {
          codigo: f.codigo, tanque: f.tanque, probabilidad: f.probabilidad, semaforo: f.semaforo,
          razones: f.razones, advertencias: f.advertencias, nota: f.nota, guardadoAhora: false,
          extra: f.decision_actual ? `Dirección lo marcó como ${f.decision_actual} (${fechaHora(f.decisiones[0].fecha)}).` : undefined,
        },
      });
    } catch {
      setErrorLote(true);
    } finally {
      setCargandoLote(false);
    }
  };

  return (
    <>
      <Cabecera rol={rol} onRol={onRol} nombre={nombre} onNombre={onNombre} />
      <main>
        {errorLote && <div className="mx-auto max-w-xl px-4 pt-4"><ErrorCaja>No se pudo abrir el lote.</ErrorCaja></div>}
        {cargandoLote && <Cargando texto="Abriendo el lote…" />}
        {vista.tipo === "inicio" && (
          <Inicio nombre={nombre} pendientes={pendientes} enLinea={enLinea} onCapturar={() => ir({ tipo: "captura" })} onAbrir={abrirLote} />
        )}
        {vista.tipo === "captura" &&
          (variables ? (
            <Captura
              variables={variables}
              nombre={nombre}
              onCancelar={() => ir({ tipo: "inicio" })}
              onEvaluado={(datos) => ir({ tipo: "resultado", datos })}
              onPendiente={(p) => ir({ tipo: "pendiente", p })}
            />
          ) : (
            <div className="mx-auto max-w-xl px-4 pt-6">
              <ErrorCaja>No se pudo cargar el formulario. Conéctate una vez a internet para descargar la lista de análisis.</ErrorCaja>
            </div>
          ))}
        {vista.tipo === "resultado" && (
          <PantallaResultado d={vista.datos} onInicio={() => ir({ tipo: "inicio" })} onNuevo={() => ir({ tipo: "captura" })} />
        )}
        {vista.tipo === "pendiente" && (
          <PantallaPendiente p={vista.p} onInicio={() => ir({ tipo: "inicio" })} onNuevo={() => ir({ tipo: "captura" })} />
        )}
      </main>
    </>
  );
}
