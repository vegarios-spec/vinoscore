import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ErrorApi } from "../api";
import { descartarPendiente, EVENTO, guardarPendiente, listarPendientes, nuevoId, sincronizar } from "../offline";
import type { Pendiente } from "../offline";
import type { CapturaPayload, LoteFicha, LoteResumen, Resultado, Variable } from "../tipos";
import { Avisos, Boton, Cargando, ErrorCaja, InsigniaDemo, InsigniaSemaforo, ListaRazones, SemaforoGrande, Tarjeta, TextoProbabilidad, Vacio } from "../ui";
import { fechaHora, leerNumero, num, pct } from "../util";

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

  const enviarAhora = async () => {
    setEnviando(true);
    await sincronizar();
    setEnviando(false);
  };

  if (!enLinea) {
    return (
      <div role="status" className="rounded-xl border border-amarillo bg-amarillo-claro p-3 text-sm text-amarillo-texto">
        <strong>Sin conexión.</strong> Puedes seguir capturando: se guarda en el teléfono y se envía solo cuando vuelva
        la red.{porEnviar.length > 0 && ` Pendientes: ${porEnviar.length}.`}
      </div>
    );
  }
  if (porEnviar.length > 0) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-turquesa bg-white p-3 text-sm">
        <span>
          <strong>{porEnviar.length}</strong> {porEnviar.length === 1 ? "captura pendiente" : "capturas pendientes"} de enviar.
        </span>
        <Boton variante="secundario" onClick={enviarAhora} disabled={enviando} className="min-h-10">
          {enviando ? "Enviando…" : "Enviar ahora"}
        </Boton>
      </div>
    );
  }
  return null;
}

// ----------------------------------------------------------------- formulario
function fueraDeRango(v: number, x: Variable): boolean {
  return v < x.rango_normal[0] || v > x.rango_normal[1];
}

function Formulario({
  variables, nombre, onEvaluado, onPendiente,
}: {
  variables: Variable[];
  nombre: string;
  onEvaluado: (r: Resultado) => void;
  onPendiente: (p: Pendiente) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [tanque, setTanque] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primeraFalta = useRef<HTMLFormElement>(null);

  const numeros = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const v of variables) out[v.clave] = leerNumero(textos[v.clave] ?? "");
    return out;
  }, [textos, variables]);

  const faltan = (codigo.trim() === "" ? 1 : 0) + variables.filter((v) => numeros[v.clave] === null).length;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntento(true);
    setError(null);
    if (faltan > 0) {
      primeraFalta.current?.querySelector<HTMLElement>("[data-falta='true']")?.focus();
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
      onEvaluado(await api.crearAnalisis(payload));
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(`No se pudo guardar: ${err.message}`);
      } else {
        // Sin red: se guarda en el teléfono para enviarlo después.
        onPendiente(await guardarPendiente(payload));
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form ref={primeraFalta} onSubmit={enviar} noValidate className="space-y-4">
      <Tarjeta className="space-y-4">
        <h2 className="text-xl font-bold text-marino">Datos del lote</h2>
        <Campo
          id="codigo" etiqueta="Código del lote" valor={codigo} onCambio={setCodigo}
          falta={intento && codigo.trim() === ""} texto placeholder="Ej. L-2026-014"
        />
        <Campo id="tanque" etiqueta="Tanque (opcional)" valor={tanque} onCambio={setTanque} texto placeholder="Ej. T-03" />
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-marino">Análisis de laboratorio</h2>
          <p className="text-sm text-suave">Escribe cada valor tal como lo marca el laboratorio. Puedes usar punto o coma.</p>
        </div>
        {variables.map((v, i) => {
          const n = numeros[v.clave];
          return (
            <Campo
              key={v.clave}
              id={v.clave}
              etiqueta={`${i + 1}. ${v.nombre}`}
              unidad={v.unidad}
              ayuda={v.ayuda}
              valor={textos[v.clave] ?? ""}
              onCambio={(t) => setTextos((x) => ({ ...x, [v.clave]: t }))}
              falta={intento && n === null}
              aviso={
                n !== null && fueraDeRango(n, v)
                  ? `Fuera de lo normal (${num(v.rango_normal[0], v.decimales)} a ${num(v.rango_normal[1], v.decimales)}). Revisa que esté bien capturado.`
                  : undefined
              }
            />
          );
        })}
      </Tarjeta>

      {intento && faltan > 0 && (
        <ErrorCaja>
          Faltan {faltan} {faltan === 1 ? "dato" : "datos"}. Revisa los campos marcados.
        </ErrorCaja>
      )}
      {error && <ErrorCaja>{error}</ErrorCaja>}

      <Boton type="submit" grande variante="secundario" className="w-full" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar y evaluar"}
      </Boton>
    </form>
  );
}

function Campo({
  id, etiqueta, valor, onCambio, unidad, ayuda, aviso, falta, texto, placeholder,
}: {
  id: string; etiqueta: string; valor: string; onCambio: (t: string) => void;
  unidad?: string; ayuda?: string; aviso?: string; falta?: boolean; texto?: boolean; placeholder?: string;
}) {
  const descId = `${id}-desc`;
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={descId} className="text-sm text-suave">
          {ayuda}
        </p>
      )}
      <div className="relative mt-1">
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
          data-falta={falta ? "true" : undefined}
          aria-invalid={falta || undefined}
          aria-describedby={[ayuda ? descId : "", aviso ? `${id}-aviso` : ""].join(" ").trim() || undefined}
          className={`min-h-13 w-full rounded-xl border-2 bg-white px-3 text-lg tabular
            ${unidad ? "pr-20" : ""}
            ${falta ? "border-rojo" : aviso ? "border-amarillo" : "border-borde"}`}
        />
        {unidad && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-suave">
            {unidad}
          </span>
        )}
      </div>
      {falta && <p className="mt-1 text-sm font-semibold text-rojo-texto">Falta este dato.</p>}
      {aviso && (
        <p id={`${id}-aviso`} className="mt-1 rounded-lg bg-amarillo-claro px-2 py-1 text-sm font-medium text-amarillo-texto">
          ⚠ {aviso}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ resultado
function PantallaResultado({ res, onNuevo }: { res: Resultado; onNuevo: () => void }) {
  return (
    <div className="space-y-4">
      <Tarjeta className="space-y-3">
        <p className="text-sm text-suave">
          Lote <strong className="text-tinta">{res.codigo}</strong>
          {res.tanque && <> · Tanque {res.tanque}</>} · guardado
        </p>
        <SemaforoGrande semaforo={res.semaforo} probabilidad={res.probabilidad} />
        <TextoProbabilidad p={res.probabilidad} />
      </Tarjeta>
      <Avisos avisos={res.advertencias} />
      <Tarjeta>
        <ListaRazones razones={res.razones} nota={res.nota} />
      </Tarjeta>
      <Boton grande className="w-full" onClick={onNuevo}>
        Capturar otro lote
      </Boton>
    </div>
  );
}

function PantallaPendiente({ p, onNuevo }: { p: Pendiente; onNuevo: () => void }) {
  return (
    <div className="space-y-4">
      <Tarjeta className="space-y-2 border-amarillo bg-amarillo-claro">
        <p className="text-xl font-extrabold text-amarillo-texto">Guardado en el teléfono</p>
        <p>
          No hay conexión, así que el lote <strong>{p.payload.codigo}</strong> quedó pendiente. Cuando vuelva la red se enviará
          solo y podrás ver aquí su resultado.
        </p>
      </Tarjeta>
      <Boton grande className="w-full" onClick={onNuevo}>
        Capturar otro lote
      </Boton>
    </div>
  );
}

// ------------------------------------------------------------------ historial
function ItemHistorial({ lote }: { lote: LoteResumen }) {
  const [ficha, setFicha] = useState<LoteFicha | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState(false);

  const alternar = async () => {
    setAbierto((a) => !a);
    if (!ficha && !error) {
      try {
        setFicha(await api.lote(lote.id));
      } catch {
        setError(true);
      }
    }
  };

  return (
    <li className="rounded-2xl border border-borde bg-white">
      <button
        onClick={alternar}
        aria-expanded={abierto}
        className="flex min-h-16 w-full items-center justify-between gap-3 p-3 text-left"
      >
        <span>
          <span className="flex items-center gap-2 font-bold">
            {lote.codigo} {lote.es_demo && <InsigniaDemo />}
          </span>
          <span className="text-sm text-suave">
            {fechaHora(lote.fecha)}
            {lote.tanque && ` · ${lote.tanque}`}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <InsigniaSemaforo semaforo={lote.semaforo} />
          {lote.probabilidad !== null && <span className="text-sm tabular text-suave">{pct(lote.probabilidad)}</span>}
        </span>
      </button>
      {abierto && (
        <div className="border-t border-borde p-3">
          {error && <p className="text-rojo-texto">No se pudo cargar el detalle.</p>}
          {!ficha && !error && <Cargando />}
          {ficha && (
            <div className="space-y-3">
              <Avisos avisos={ficha.advertencias} />
              <ListaRazones razones={ficha.razones} nota={ficha.nota} />
              {ficha.decision_actual && (
                <p className="rounded-xl bg-fondo p-3 text-sm">
                  Decisión de Sergio: <strong>{ficha.decision_actual}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Historial({ nombre, pendientes }: { nombre: string; pendientes: Pendiente[] }) {
  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .lotes({ capturado_por: nombre, orden: "fecha" })
      .then((l) => vigente && setLotes(l))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [nombre, pendientes.length]);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-marino">Mis capturas</h2>
      {pendientes.length > 0 && (
        <ul className="space-y-2">
          {pendientes.map((p) => (
            <li key={p.id_cliente} className="flex items-center justify-between gap-3 rounded-2xl border border-amarillo bg-amarillo-claro p-3">
              <span>
                <span className="block font-bold">{p.payload.codigo}</span>
                <span className="text-sm text-amarillo-texto">
                  {p.error ? `No se pudo enviar: ${p.error}` : "Pendiente de enviar (sin conexión)"}
                </span>
              </span>
              {p.error && (
                <Boton variante="borde" className="min-h-10" onClick={() => descartarPendiente(p.id_cliente)}>
                  Descartar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorCaja>No se pudo cargar el historial. Revisa tu conexión.</ErrorCaja>}
      {!lotes && !error && <Cargando />}
      {lotes && lotes.length === 0 && pendientes.length === 0 && (
        <Vacio>Todavía no has capturado lotes con el nombre “{nombre}”.</Vacio>
      )}
      {lotes && (
        <ul className="space-y-2">
          {lotes.map((l) => (
            <ItemHistorial key={l.id} lote={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- la vista
type Pantalla =
  | { tipo: "formulario" }
  | { tipo: "evaluado"; res: Resultado }
  | { tipo: "pendiente"; p: Pendiente };

export function VistaEnologa({
  variables, nombre, onNombre,
}: {
  variables: Variable[] | null;
  nombre: string;
  onNombre: (n: string) => void;
}) {
  const [tab, setTab] = useState<"capturar" | "historial">("capturar");
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "formulario" });
  const [formKey, setFormKey] = useState(0);
  const enLinea = useEnLinea();
  const pendientes = usePendientes();

  const nuevo = () => {
    setPantalla({ tipo: "formulario" });
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-xl px-3 pb-28 pt-4">
      <div className="space-y-4">
        <BannerConexion enLinea={enLinea} pendientes={pendientes} />

        <label className="block text-sm">
          <span className="font-semibold">Capturas como</span>
          <input
            value={nombre}
            onChange={(e) => onNombre(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border-2 border-borde bg-white px-3 text-base"
            autoComplete="off"
          />
        </label>

        {tab === "capturar" && (
          <>
            {pantalla.tipo === "formulario" &&
              (variables ? (
                <Formulario
                  key={formKey}
                  variables={variables}
                  nombre={nombre}
                  onEvaluado={(res) => {
                    setPantalla({ tipo: "evaluado", res });
                    window.scrollTo({ top: 0 });
                  }}
                  onPendiente={(p) => {
                    setPantalla({ tipo: "pendiente", p });
                    window.scrollTo({ top: 0 });
                  }}
                />
              ) : (
                <ErrorCaja>
                  No se pudo cargar el formulario. Conéctate una vez a internet para descargar la lista de análisis.
                </ErrorCaja>
              ))}
            {pantalla.tipo === "evaluado" && <PantallaResultado res={pantalla.res} onNuevo={nuevo} />}
            {pantalla.tipo === "pendiente" && <PantallaPendiente p={pantalla.p} onNuevo={nuevo} />}
          </>
        )}
        {tab === "historial" && <Historial nombre={nombre} pendientes={pendientes} />}
      </div>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 border-t border-borde bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {(["capturar", "historial"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`min-h-16 text-base font-bold ${tab === t ? "border-t-4 border-turquesa text-turquesa" : "border-t-4 border-transparent text-suave"}`}
          >
            {t === "capturar" ? "Capturar lote" : `Historial${pendientes.length ? ` (${pendientes.length})` : ""}`}
          </button>
        ))}
      </nav>
    </div>
  );
}
