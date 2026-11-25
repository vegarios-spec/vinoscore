import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Panel } from "../Panel";
import { Sello } from "../Sello";
import type { Decision, LoteFicha, LoteResumen, Simulacion, Variable } from "../tipos";
import { Avisos, Boton, Cargando, ErrorCaja, InsigniaDemo, ListaRazones } from "../ui";
import { SEMAFORO, fechaHora, fechaRelativa, fraseProbabilidad, num, pct } from "../util";

const CONTROLES: { clave: string; paso: number }[] = [
  { clave: "alcohol", paso: 0.1 },
  { clave: "density", paso: 0.0001 },
  { clave: "chlorides", paso: 0.001 },
];

const CHIP_DECISION: Record<Decision, string> = {
  Premium: "bg-turquesa/10 text-turquesa-oscuro ring-1 ring-turquesa/40",
  "Mandar a cata": "bg-ambar-claro text-amber-900 ring-1 ring-laton/50",
  "Estándar": "bg-hielo text-marino ring-1 ring-borde",
};

// ---------------------------------------------------------------- simulador
function Simulador({ ficha, variables, umbral }: { ficha: LoteFicha; variables: Variable[]; umbral: number }) {
  const inicial = useMemo(() => Object.fromEntries(CONTROLES.map((c) => [c.clave, ficha.valores[c.clave]])), [ficha]);
  const [valores, setValores] = useState<Record<string, number>>(inicial);
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const info = useMemo(() => Object.fromEntries(variables.map((v) => [v.clave, v])), [variables]);

  // Cada movimiento recalcula, sin guardar nada.
  useEffect(() => {
    const mio = ++turno.current;
    const t = setTimeout(() => {
      api
        .simular(ficha.id, valores)
        .then((s) => mio === turno.current && (setSim(s), setError(null)))
        .catch(() => mio === turno.current && setError("No se pudo calcular la simulación."));
    }, 150);
    return () => clearTimeout(t);
  }, [valores, ficha.id]);

  const hayCambios = CONTROLES.some((c) => valores[c.clave] !== inicial[c.clave]);
  const original = ficha.probabilidad ?? 0;
  const puntos = sim ? Math.round((sim.probabilidad - original) * 100) : 0;

  return (
    <section aria-labelledby="sim-titulo" className="space-y-5">
      <div>
        <h3 id="sim-titulo" className="font-display text-[1.6rem] font-medium leading-tight text-marino">¿Qué pasa si…?</h3>
        <p className="text-sm text-suave">Mueve alcohol, densidad o cloruros y mira cómo cambia la probabilidad. Es una prueba: no se guarda nada.</p>
      </div>

      {CONTROLES.map(({ clave, paso }) => {
        const v = info[clave];
        if (!v) return null;
        const [p1, p99] = v.rango_normal;
        const holgura = (p99 - p1) * 0.3;
        const orig = inicial[clave];
        const min = Math.min(Math.max(v.rango_dato[0], p1 - holgura), orig);
        const max = Math.max(Math.min(v.rango_dato[1], p99 + holgura), orig);
        const actual = valores[clave] ?? orig;
        const cambio = Math.abs(actual - orig) > paso / 2;
        return (
          <div key={clave}>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`sl-${clave}`} className="font-semibold">{v.nombre}</label>
              <span className="font-display text-[1.9rem] font-normal tabular">
                {num(actual, v.decimales)} <span className="font-sans text-sm font-semibold text-suave">{v.unidad}</span>
              </span>
            </div>
            <input
              id={`sl-${clave}`}
              type="range"
              min={min}
              max={max}
              step={paso}
              value={actual}
              onChange={(e) => setValores((x) => ({ ...x, [clave]: Number(e.target.value) }))}
              className="mt-1 h-9 w-full"
              aria-valuetext={`${num(actual, v.decimales)} ${v.unidad}`}
            />
            <p className="text-sm text-suave">
              El lote tiene {num(orig, v.decimales)} {v.unidad}.{" "}
              {cambio && <strong className="text-marino">Cambio de {actual > orig ? "+" : "−"}{num(Math.abs(actual - orig), v.decimales)}. </strong>}
              Lo normal va de {num(p1, v.decimales)} a {num(p99, v.decimales)}.
            </p>
          </div>
        );
      })}

      {error && <ErrorCaja>{error}</ErrorCaja>}
      {sim && (
        <div aria-live="polite" className="rounded-xl bg-white p-5 ring-1 ring-borde">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-6xl font-normal leading-none tabular text-marino">{pct(sim.probabilidad)}</p>
            <p className={`rounded-md px-3 py-1 text-sm font-semibold ${SEMAFORO[sim.semaforo].fondo} ${SEMAFORO[sim.semaforo].texto}`}>
              {SEMAFORO[sim.semaforo].etiqueta}
            </p>
          </div>
          <div className="relative mt-4 h-5 rounded-full bg-hielo" aria-hidden>
            <div className={`h-full rounded-full ${SEMAFORO[sim.semaforo].relleno}`} style={{ width: `${Math.round(sim.probabilidad * 100)}%` }} />
            <span className="absolute inset-y-[-4px] w-0.5 bg-noche" style={{ left: `${original * 100}%` }} />
            <span className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: "30%" }} />
            <span className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${umbral * 100}%` }} />
          </div>
          <p className="mt-3 text-base">
            {puntos === 0 ? "Con estos valores la probabilidad casi no cambia." : `La probabilidad ${puntos > 0 ? "sube" : "baja"} ${Math.abs(puntos)} ${Math.abs(puntos) === 1 ? "punto" : "puntos"}`}
            {puntos !== 0 && <span> (antes {pct(original)}).</span>}
            {ficha.semaforo && sim.semaforo !== ficha.semaforo && (
              <strong> El lote pasaría de {SEMAFORO[ficha.semaforo].etiqueta} a {SEMAFORO[sim.semaforo].etiqueta}.</strong>
            )}
          </p>
          <p className="mt-1 text-xs text-suave">La barra marca el valor actual (línea oscura), 30 % y el umbral de la regla ({pct(umbral)}).</p>
          {sim.advertencias.length > 0 && (
            <p className="mt-3 rounded-xl bg-amarillo-claro p-3 text-sm font-medium text-amarillo-texto">
              {sim.advertencias[0]} Con valores tan raros la estimación es menos confiable.
            </p>
          )}
        </div>
      )}
      {hayCambios && (
        <Boton variante="claro" onClick={() => setValores(inicial)}>
          Volver a los valores del lote
        </Boton>
      )}
    </section>
  );
}

// -------------------------------------------------------------------- ficha
export function FichaLote({
  resumen, variables, umbral, onCerrar, onDecidido,
}: {
  resumen: LoteResumen;
  variables: Variable[];
  umbral: number;
  onCerrar: () => void;
  onDecidido: () => void;
}) {
  const [ficha, setFicha] = useState<LoteFicha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .lote(resumen.id)
      .then((f) => vigente && setFicha(f))
      .catch(() => vigente && setError("No se pudo cargar el lote."));
    return () => {
      vigente = false;
    };
  }, [resumen.id]);

  const decidir = async (d: Decision) => {
    setGuardando(true);
    setAviso(null);
    setError(null);
    try {
      await api.decidir(resumen.id, d, "Sergio", comentario.trim());
      setComentario("");
      setFicha(await api.lote(resumen.id));
      setAviso(`Listo: el lote quedó como ${d}.`);
      onDecidido();
    } catch {
      setError("No se pudo guardar la decisión. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const sem = ficha?.semaforo ?? null;
  const s = sem ? SEMAFORO[sem] : null;

  return (
    <Panel
      titulo={
        <span className="flex flex-wrap items-center gap-3">
          Lote {resumen.codigo} {resumen.es_demo && <InsigniaDemo />}
        </span>
      }
      subtitulo={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {resumen.tanque && <span>Tanque {resumen.tanque}</span>}
          <span>{fechaRelativa(resumen.fecha)}</span>
          {resumen.capturado_por && <span>Capturó {resumen.capturado_por}</span>}
        </span>
      }
      onCerrar={onCerrar}
      pie={
        <div className="space-y-3">
          <label className="block text-sm font-semibold">
            Comentario (opcional)
            <input
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={1000}
              placeholder="Ej. Probarlo el viernes con la enóloga"
              className="campo mt-1 !min-h-11 !text-base font-normal"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" disabled={guardando || !ficha} onClick={() => decidir("Premium")}>
              Aprobar como Premium
            </Boton>
            <Boton variante="ambar" disabled={guardando || !ficha} onClick={() => decidir("Mandar a cata")}>
              Mandar a cata
            </Boton>
            <Boton variante="borde" disabled={guardando || !ficha} onClick={() => decidir("Estándar")}>
              Estándar
            </Boton>
            {aviso && <span role="status" className="text-sm font-semibold text-verde-texto">{aviso}</span>}
          </div>
        </div>
      }
    >
      {error && <div className="p-5"><ErrorCaja>{error}</ErrorCaja></div>}
      {!ficha && !error && <Cargando />}
      {ficha && s && sem && ficha.probabilidad !== null && (
        <div className="space-y-9 p-5 pb-8">
          <section className="grid items-center gap-5 sm:grid-cols-[210px_1fr]">
            <div className="flex justify-center"><Sello tipo={sem} probabilidad={ficha.probabilidad} tam={200} /></div>
            <div className="space-y-2">
              <p className={`font-display text-[2.8rem] font-normal leading-none ${s.texto}`}>{s.etiqueta}</p>
              <p className="text-lg font-semibold">{s.significado}</p>
              <p className="text-sm text-suave">{fraseProbabilidad(ficha.probabilidad)}</p>
              <p className="pt-1">
                <span className="text-sm text-suave">Decisión actual: </span>
                {ficha.decision_actual ? (
                  <span className={`rounded-md px-3 py-1 text-sm font-semibold ${CHIP_DECISION[ficha.decision_actual]}`}>{ficha.decision_actual}</span>
                ) : (
                  <span className="rounded-md border border-dashed border-suave px-3 py-0.5 text-sm font-semibold text-suave">Sin decidir</span>
                )}
              </p>
            </div>
          </section>

          <Avisos avisos={ficha.advertencias} />
          <ListaRazones razones={ficha.razones} nota={ficha.nota} />
          <Simulador ficha={ficha} variables={variables} umbral={umbral} />

          <details className="group rounded-xl bg-white ring-1 ring-borde">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between px-5 font-display text-[1.6rem] font-medium leading-tight text-marino">
              Los análisis del lote <span aria-hidden className="text-base transition group-open:rotate-180">▾</span>
            </summary>
            <table className="mx-5 mb-4 w-[calc(100%-2.5rem)] text-left">
              <tbody>
                {variables.map((v) => {
                  const valor = ficha.valores[v.clave];
                  if (valor === undefined) return null;
                  const fuera = valor < v.rango_normal[0] || valor > v.rango_normal[1];
                  return (
                    <tr key={v.clave} className="border-t border-borde">
                      <th scope="row" className="py-2 pr-2 font-medium">{v.nombre}</th>
                      <td className="py-2 pr-2 text-right font-semibold tabular">
                        {num(valor, v.decimales)} <span className="font-normal text-suave">{v.unidad}</span>
                      </td>
                      <td className="w-40 py-2 text-right text-sm">
                        {fuera ? <span className="font-semibold text-amarillo-texto">Fuera de lo normal</span> : <span className="text-suave">Normal</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>

          {ficha.decisiones.length > 0 && (
            <section aria-labelledby="hist-dec">
              <h3 id="hist-dec" className="font-display text-[1.6rem] font-medium leading-tight text-marino">Decisiones anteriores</h3>
              <ul className="mt-2 divide-y divide-borde border-y border-borde">
                {ficha.decisiones.map((d) => (
                  <li key={d.id} className="py-3">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`rounded-md px-3 py-0.5 text-sm font-semibold ${CHIP_DECISION[d.decision]}`}>{d.decision}</span>
                      <span className="text-sm text-suave">{d.quien || "Sin nombre"}</span>
                      <span className="text-sm text-suave">{fechaHora(d.fecha)}</span>
                    </p>
                    {d.comentario && <p className="mt-1">“{d.comentario}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
