import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { LoteFicha, LoteResumen, Simulacion, Variable } from "../tipos";
import { Cargando, ErrorCaja, InsigniaSemaforo, Tarjeta, Vacio } from "../ui";
import { SEMAFORO, num, pct } from "../util";

/** Variables que se pueden mover con los controles deslizantes. */
const CONTROLES: { clave: string; paso: number }[] = [
  { clave: "alcohol", paso: 0.1 },
  { clave: "density", paso: 0.0001 },
  { clave: "chlorides", paso: 0.001 },
];

function Barra({ titulo, p, semaforo }: { titulo: string; p: number; semaforo: keyof typeof SEMAFORO }) {
  const s = SEMAFORO[semaforo];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{titulo}</span>
        <span className="text-2xl font-extrabold tabular">{pct(p)}</span>
      </div>
      <div className="mt-1 h-4 overflow-hidden rounded-full bg-borde" aria-hidden>
        <div className={`h-full rounded-full ${s.relleno}`} style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <div className="mt-1">
        <InsigniaSemaforo semaforo={semaforo} />
      </div>
    </div>
  );
}

export function VistaSimulador({
  variables, loteInicial,
}: {
  variables: Variable[];
  loteInicial: number | null;
}) {
  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [loteId, setLoteId] = useState<number | null>(loteInicial);
  const [ficha, setFicha] = useState<LoteFicha | null>(null);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);

  useEffect(() => {
    api
      .lotes()
      .then((l) => {
        setLotes(l);
        setLoteId((actual) => actual ?? l[0]?.id ?? null);
      })
      .catch(() => setError("No se pudieron cargar los lotes."));
  }, []);

  useEffect(() => {
    if (loteInicial !== null) setLoteId(loteInicial);
  }, [loteInicial]);

  // Al elegir lote, los controles arrancan con sus valores reales.
  useEffect(() => {
    if (loteId === null) return;
    let vigente = true;
    setFicha(null);
    setSim(null);
    api
      .lote(loteId)
      .then((f) => {
        if (!vigente) return;
        setFicha(f);
        setValores(Object.fromEntries(CONTROLES.map((c) => [c.clave, f.valores[c.clave]])));
      })
      .catch(() => vigente && setError("No se pudo cargar el lote."));
    return () => {
      vigente = false;
    };
  }, [loteId]);

  // Cada cambio recalcula (sin guardar nada), con una pequeña espera para no saturar.
  useEffect(() => {
    if (loteId === null || !ficha || ficha.id !== loteId) return;
    const mio = ++turno.current;
    const t = setTimeout(() => {
      api
        .simular(loteId, valores)
        .then((s) => mio === turno.current && (setSim(s), setError(null)))
        .catch(() => mio === turno.current && setError("No se pudo calcular la simulación."));
    }, 150);
    return () => clearTimeout(t);
  }, [valores, loteId, ficha]);

  const info = useMemo(() => Object.fromEntries(variables.map((v) => [v.clave, v])), [variables]);

  const restablecer = () => {
    if (ficha) setValores(Object.fromEntries(CONTROLES.map((c) => [c.clave, ficha.valores[c.clave]])));
  };

  const hayCambios = ficha ? CONTROLES.some((c) => valores[c.clave] !== ficha.valores[c.clave]) : false;
  const original = ficha && ficha.probabilidad !== null && ficha.semaforo ? { p: ficha.probabilidad, s: ficha.semaforo } : null;

  let resumen: string | null = null;
  if (sim && original) {
    const dif = Math.round((sim.probabilidad - original.p) * 100);
    const cambio = dif === 0 ? "casi no cambia" : `${dif > 0 ? "sube" : "baja"} ${Math.abs(dif)} puntos`;
    resumen = `Con estos cambios la probabilidad ${cambio}: de ${pct(original.p)} a ${pct(sim.probabilidad)}.`;
    if (sim.semaforo !== original.s) {
      resumen += ` El lote pasaría de “${SEMAFORO[original.s].etiqueta}” a “${SEMAFORO[sim.semaforo].etiqueta}”.`;
    }
  }

  return (
    <div className="space-y-5">
      <Tarjeta className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-marino">¿Qué pasa si…?</h2>
          <p className="text-suave">
            Mueve alcohol, densidad o cloruros y mira cómo cambiaría la probabilidad. Es solo una prueba: no se guarda nada.
          </p>
        </div>
        {lotes && lotes.length === 0 && <Vacio>Todavía no hay lotes para simular.</Vacio>}
        {lotes && lotes.length > 0 && (
          <label className="block max-w-md font-semibold">
            Lote
            <select
              value={loteId ?? ""}
              onChange={(e) => setLoteId(Number(e.target.value))}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-borde bg-white px-3 text-base font-normal"
            >
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo}
                  {l.es_demo ? " (demo)" : ""} · {l.probabilidad !== null ? pct(l.probabilidad) : "sin evaluar"}
                </option>
              ))}
            </select>
          </label>
        )}
      </Tarjeta>

      {error && <ErrorCaja>{error}</ErrorCaja>}
      {loteId !== null && !ficha && !error && <Cargando />}

      {ficha && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta className="space-y-6">
            <h3 className="text-lg font-bold text-marino">Lote {ficha.codigo}</h3>
            {CONTROLES.map(({ clave, paso }) => {
              const v = info[clave];
              if (!v) return null;
              const [p1, p99] = v.rango_normal;
              const holgura = (p99 - p1) * 0.3;
              const min = Math.max(v.rango_dato[0], p1 - holgura);
              const max = Math.min(v.rango_dato[1], p99 + holgura);
              const actual = valores[clave] ?? ficha.valores[clave];
              const orig = ficha.valores[clave];
              const cambio = Math.abs(actual - orig) > paso / 2;
              return (
                <div key={clave}>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={`sl-${clave}`} className="text-base font-bold">
                      {v.nombre}
                    </label>
                    <span className="text-xl font-extrabold tabular">
                      {num(actual, v.decimales)} <span className="text-sm font-medium text-suave">{v.unidad}</span>
                    </span>
                  </div>
                  <input
                    id={`sl-${clave}`}
                    type="range"
                    min={Math.min(min, orig)}
                    max={Math.max(max, orig)}
                    step={paso}
                    value={actual}
                    onChange={(e) => setValores((x) => ({ ...x, [clave]: Number(e.target.value) }))}
                    className="mt-2 h-8 w-full"
                    aria-valuetext={`${num(actual, v.decimales)} ${v.unidad}`}
                  />
                  <p className="text-sm text-suave">
                    Valor del lote: {num(orig, v.decimales)} {v.unidad}
                    {cambio && (
                      <span className="font-semibold text-marino">
                        {" "}· {actual > orig ? "+" : "−"}
                        {num(Math.abs(actual - orig), v.decimales)} de cambio
                      </span>
                    )}
                    {" "}· Normal: {num(p1, v.decimales)} a {num(p99, v.decimales)}
                  </p>
                </div>
              );
            })}
            <button
              onClick={restablecer}
              disabled={!hayCambios}
              className="min-h-11 rounded-xl border border-marino px-4 font-semibold text-marino hover:bg-fondo disabled:opacity-40"
            >
              Volver a los valores del lote
            </button>
          </Tarjeta>

          <Tarjeta className="space-y-5" >
            <h3 className="text-lg font-bold text-marino">Resultado</h3>
            {original && <Barra titulo="Lote como está" p={original.p} semaforo={original.s} />}
            {sim ? (
              <div aria-live="polite" className="space-y-4">
                <Barra titulo="Con tus cambios" p={sim.probabilidad} semaforo={sim.semaforo} />
                {resumen && <p className="rounded-xl bg-fondo p-3 text-base font-medium">{resumen}</p>}
                {sim.advertencias.length > 0 && (
                  <p className="rounded-xl bg-amarillo-claro p-3 text-sm font-medium text-amarillo-texto">
                    ⚠ {sim.advertencias[0]} Con valores tan raros la estimación es menos confiable.
                  </p>
                )}
              </div>
            ) : (
              <Cargando texto="Calculando…" />
            )}
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
