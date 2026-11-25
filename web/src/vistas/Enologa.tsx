import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ErrorApi } from "../api";
import { Cabecera } from "../Cabecera";
import type { Rol } from "../Cabecera";
import { descartarPendiente, EVENTO, guardarPendiente, listarPendientes, nuevoId, sincronizar } from "../offline";
import type { Pendiente } from "../offline";
import { Sello, SelloMini } from "../Sello";
import type { CapturaPayload, Razon, Semaforo, Variable } from "../tipos";
import { Avisos, Boton, Cargando, ErrorCaja, InsigniaDemo, ListaRazones, Vacio } from "../ui";
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
      <div role="status" className="rounded-xl bg-amarillo-claro p-4 text-amarillo-texto ring-1 ring-amarillo">
        <p className="font-semibold">Sin conexión</p>
        <p className="text-sm">
          Puedes seguir capturando: se guarda en el teléfono y se envía solo cuando vuelva la red.
          {porEnviar.length > 0 && ` Pendientes: ${porEnviar.length}.`}
        </p>
      </div>
    );
  }
  if (porEnviar.length > 0) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-turquesa">
        <p>
          <strong>{porEnviar.length}</strong> {porEnviar.length === 1 ? "captura espera" : "capturas esperan"} conexión para enviarse.
        </p>
        <Boton
          variante="secundario"
          className="min-h-10"
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
    <form onSubmit={enviar} noValidate className="mx-auto max-w-xl px-4 pb-44 pt-4">
      <button type="button" onClick={onCancelar} className="-ml-2 min-h-11 rounded-lg px-3 font-semibold text-turquesa hover:bg-hielo">
        <span aria-hidden>‹ </span>Cancelar captura
      </button>
      <h1 className="mt-2 font-display text-[2.7rem] font-normal leading-[1.05] text-marino">Lote nuevo</h1>

      <fieldset className="mt-6 space-y-4">
        <legend className="font-display text-[1.6rem] font-medium text-marino">Identifica el lote</legend>
        <Campo id="codigo" etiqueta="Código del lote" valor={codigo} onCambio={setCodigo} falta={intento && codigo.trim() === ""} texto placeholder="Ej. L-2026-014" />
        <Campo id="tanque" etiqueta="Tanque (opcional)" valor={tanque} onCambio={setTanque} texto placeholder="Ej. T-03" />
      </fieldset>

      {grupos.map((g) => (
        <fieldset key={g.titulo} className="mt-9 space-y-4">
          <legend className="font-display text-[1.6rem] font-medium text-marino">{g.titulo}</legend>
          {g.vars.map((v) => {
            const n = numeros[v.clave];
            return (
              <Campo
                key={v.clave}
                id={v.clave}
                etiqueta={v.nombre}
                unidad={v.unidad}
                ayuda={v.ayuda}
                valor={textos[v.clave] ?? ""}
                onCambio={(t) => setTextos((x) => ({ ...x, [v.clave]: t }))}
                falta={intento && n === null}
                aviso={
                  n !== null && fueraDeRango(n, v)
                    ? `Se ve fuera de lo normal (${num(v.rango_normal[0], v.decimales)} a ${num(v.rango_normal[1], v.decimales)}). Revisa que esté bien capturado.`
                    : undefined
                }
              />
            );
          })}
        </fieldset>
      ))}

      {error && <div className="mt-6"><ErrorCaja>{error}</ErrorCaja></div>}

      {/* Barra fija: cuánto llevas y el botón de guardar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{capturados} de {total} análisis</span>
            {intento && faltan > 0 && <span className="text-rojo-texto">Faltan {faltan}</span>}
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-hielo" aria-hidden>
            <div className="h-full rounded-full bg-turquesa transition-[width]" style={{ width: `${(capturados / total) * 100}%` }} />
          </div>
          <Boton type="submit" grande variante="secundario" className="w-full" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar y evaluar"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

function Campo({
  id, etiqueta, valor, onCambio, unidad, ayuda, aviso, falta, texto, placeholder,
}: {
  id: string; etiqueta: string; valor: string; onCambio: (t: string) => void;
  unidad?: string; ayuda?: string; aviso?: string; falta?: boolean; texto?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {etiqueta}
      </label>
      {ayuda && <p id={`${id}-ayuda`} className="text-sm text-suave">{ayuda}</p>}
      <div className="relative mt-1.5">
        <input
          id={id}
          name={id}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          type="text"
          inputMode={texto ? "text" : "decimal"}
          autoComplete="off"
          autoCapitalize={texto ? "characters" : "off"}
          enterKeyHint="next"
          placeholder={placeholder}
          aria-invalid={falta || undefined}
          aria-describedby={[ayuda ? `${id}-ayuda` : "", aviso ? `${id}-aviso` : ""].join(" ").trim() || undefined}
          className={`campo tabular ${unidad ? "pr-20" : ""} ${aviso ? "campo-aviso" : ""}`}
        />
        {unidad && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-suave">
            {unidad}
          </span>
        )}
      </div>
      {falta && <p className="mt-1 text-sm font-semibold text-rojo-texto">Falta este dato.</p>}
      {aviso && (
        <p id={`${id}-aviso`} className="mt-1.5 rounded-xl bg-amarillo-claro px-3 py-2 text-sm font-medium text-amarillo-texto">
          {aviso}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ resultado
function PantallaResultado({ d, onInicio, onNuevo }: { d: DatosResultado; onInicio: () => void; onNuevo: () => void }) {
  const s = SEMAFORO[d.semaforo];
  return (
    <div>
      <section className="overflow-hidden bg-noche px-5 pb-12 text-white">
        {/* El color del semáforo vive en esta franja y en el sello; la palabra va siempre escrita */}
        <div aria-hidden className={`-mx-5 h-1 ${s.relleno}`} />
        <div className="mx-auto max-w-xl pt-7">
          <p className="text-center text-[0.95rem] text-white/70">
            Lote <strong className="font-semibold text-white">{d.codigo}</strong>
            {d.tanque && <span>, tanque {d.tanque}</span>}
          </p>
          <div className="mt-6 flex justify-center">
            <Sello tipo={d.semaforo} probabilidad={d.probabilidad} tam={236} />
          </div>
          <h1 className="mt-7 text-center font-display text-[3rem] font-normal leading-none">{s.etiqueta}</h1>
          <p className="mx-auto mt-3 max-w-xs text-center text-[1.05rem] leading-snug text-white/80">{s.significado}</p>
        </div>
      </section>

      <section className="bg-papel px-5 pb-12 pt-8">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="text-base text-suave">{fraseProbabilidad(d.probabilidad)}</p>
          {d.extra && <p className="rounded-lg border border-borde bg-white p-4 font-medium text-marino">{d.extra}</p>}
          <Avisos avisos={d.advertencias} />
          <ListaRazones razones={d.razones} nota={d.nota} />
          <div className="space-y-3 pt-2">
            {d.guardadoAhora && (
              <Boton grande variante="ambar" className="w-full" onClick={onNuevo}>
                Capturar otro lote
              </Boton>
            )}
            <Boton grande variante="borde" className="w-full" onClick={onInicio}>
              Volver a mis lotes
            </Boton>
          </div>
        </div>
      </section>
    </div>
  );
}

function PantallaPendiente({ p, onInicio, onNuevo }: { p: Pendiente; onInicio: () => void; onNuevo: () => void }) {
  return (
    <div>
      <section className="border-b border-borde bg-white px-5 pb-12 pt-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="flex justify-center">
            <Sello tipo="pendiente" tam={220} />
          </div>
          <h1 className="mt-6 font-display text-[2.6rem] font-normal leading-[1.05] text-marino">Guardado en tu teléfono</h1>
          <p className="mx-auto mt-3 max-w-sm text-lg text-tinta">
            No hay conexión, así que el lote <strong>{p.payload.codigo}</strong> espera. En cuanto vuelva la red se envía solo y verás su resultado en tus lotes.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-xl space-y-3 px-5 py-8">
        <Boton grande variante="ambar" className="w-full" onClick={onNuevo}>
          Capturar otro lote
        </Boton>
        <Boton grande variante="borde" className="w-full" onClick={onInicio}>
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
    <div className="mx-auto max-w-xl px-4 pb-16 pt-7">
      <h1 className="font-display text-[2.7rem] font-normal leading-[1.05] text-marino">Hola, {nombre || "enóloga"}.</h1>
      <p className="mt-2 text-lg text-suave">
        {lotes === null ? " " : hoy > 0 ? `Hoy llevas ${hoy} ${hoy === 1 ? "lote" : "lotes"}.` : "Todavía no capturas lotes hoy."}
      </p>

      <div className="mt-5 space-y-3">
        <BannerConexion enLinea={enLinea} pendientes={pendientes} />
        <Boton grande variante="primario" className="w-full !min-h-[4rem] !text-xl" onClick={onCapturar}>
          <span aria-hidden className="text-2xl font-light leading-none text-ambar">+</span> Capturar lote nuevo
        </Boton>
      </div>

      <h2 className="mt-10 font-display text-[1.9rem] font-medium leading-none text-marino">Tus lotes recientes</h2>

      {pendientes.length > 0 && (
        <ul className="mt-3 divide-y divide-borde border-y border-borde">
          {pendientes.map((p) => (
            <li key={p.id_cliente} className="flex items-center gap-3 py-3">
              <SelloMini tipo="pendiente" tam={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.payload.codigo}</p>
                <p className="text-sm text-suave">{p.error ? `No se pudo enviar: ${p.error}` : "Esperando conexión para enviarse"}</p>
              </div>
              {p.error && (
                <Boton variante="claro" className="min-h-10" onClick={() => descartarPendiente(p.id_cliente)}>
                  Descartar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <div className="mt-3"><ErrorCaja>No se pudieron cargar tus lotes. Revisa la conexión.</ErrorCaja></div>}
      {!lotes && !error && <Cargando />}
      {lotes && lotes.length === 0 && pendientes.length === 0 && (
        <div className="mt-3">
          <Vacio titulo="Aquí van a aparecer tus lotes">Captura el primero con el botón de arriba y verás su resultado al instante.</Vacio>
        </div>
      )}
      {lotes && lotes.length > 0 && (
        <ul className="mt-3 divide-y divide-borde border-y border-borde">
          {lotes.slice(0, 15).map((l) => (
            <li key={l.id}>
              <button onClick={() => onAbrir(l.id)} className="flex min-h-[4.5rem] w-full items-center gap-3 py-3 text-left hover:bg-white/70">
                {l.semaforo && <SelloMini tipo={l.semaforo} tam={40} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{l.codigo}</span>
                    {l.es_demo && <InsigniaDemo />}
                  </span>
                  <span className="block text-sm text-suave">
                    {l.tanque ? `Tanque ${l.tanque}, ` : ""}
                    {fechaRelativa(l.fecha)}
                  </span>
                </span>
                <span className="text-right">
                  {l.probabilidad !== null && <span className="block font-display text-[1.9rem] font-normal leading-none tabular">{pct(l.probabilidad)}</span>}
                  {l.semaforo && <span className={`block text-sm font-semibold ${SEMAFORO[l.semaforo].texto}`}>{SEMAFORO[l.semaforo].etiqueta}</span>}
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
          extra: f.decision_actual ? `Sergio lo marcó como ${f.decision_actual} (${fechaHora(f.decisiones[0].fecha)}).` : undefined,
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
