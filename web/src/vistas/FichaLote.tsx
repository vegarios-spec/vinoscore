import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { Decision, LoteFicha, LoteResumen, Simulacion, Variable } from "../tipos";
import { Avisos, BarraProbabilidad, Boton, Cargando, ErrorCaja, InsigniaDemo, InsigniaSemaforo, ListaRazones } from "../ui";
import { SEMAFORO, fechaHora, fechaRelativa, fraseProbabilidad, num, pct } from "../util";

const CONTROLES: { clave: string; paso: number }[] = [
  { clave: "alcohol", paso: 0.1 },
  { clave: "density", paso: 0.0001 },
  { clave: "chlorides", paso: 0.001 },
];

function Subtitulo({ children }: { children: string }) {
  return <h3 className="text-base font-medium">{children}</h3>;
}

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
    <section aria-labelledby="sim-titulo" className="space-y-4">
      <div>
        <h3 id="sim-titulo" className="text-base font-medium">Simulador</h3>
        <p className="text-xs text-suave">Cambia alcohol, densidad o cloruros para ver cómo cambiaría la probabilidad. No se guarda nada.</p>
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
              <label htmlFor={`sl-${clave}`} className="text-sm">{v.nombre}</label>
              <span className="text-sm font-medium tabular">
                {num(actual, v.decimales)} <span className="font-normal text-suave">{v.unidad}</span>
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
              className="h-6 w-full"
              aria-valuetext={`${num(actual, v.decimales)} ${v.unidad}`}
            />
            <p className="text-xs text-suave tabular">
              Lote: {num(orig, v.decimales)} {v.unidad}
              {cambio && <span className="text-texto">, cambio {actual > orig ? "+" : "−"}{num(Math.abs(actual - orig), v.decimales)}</span>}
              . Normal: {num(p1, v.decimales)} – {num(p99, v.decimales)}
            </p>
          </div>
        );
      })}

      {error && <ErrorCaja>{error}</ErrorCaja>}
      {sim && (
        <div aria-live="polite" className="border border-linea p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-xl font-medium leading-none tabular">{pct(sim.probabilidad)}</p>
            <InsigniaSemaforo semaforo={sim.semaforo} />
          </div>
          <div className="mt-3">
            <BarraProbabilidad p={sim.probabilidad} semaforo={sim.semaforo} umbral={umbral} marcas={[original]} />
          </div>
          <p className="mt-3 text-sm">
            {puntos === 0 ? "Con estos valores la probabilidad casi no cambia." : `La probabilidad ${puntos > 0 ? "sube" : "baja"} ${Math.abs(puntos)} ${Math.abs(puntos) === 1 ? "punto" : "puntos"}`}
            {puntos !== 0 && <span className="text-suave"> (antes {pct(original)}).</span>}
            {ficha.semaforo && sim.semaforo !== ficha.semaforo && (
              <strong className="font-medium"> Pasaría de {SEMAFORO[ficha.semaforo].etiqueta} a {SEMAFORO[sim.semaforo].etiqueta}.</strong>
            )}
          </p>
          <p className="mt-1 text-xs text-suave">Línea fuerte: umbral de la regla ({pct(umbral)}). Línea gris: valor original del lote.</p>
          {sim.advertencias.length > 0 && (
            <p className="mt-3 border-l-2 border-ambar pl-3 text-xs">{sim.advertencias[0]} Con valores tan raros la estimación es menos confiable.</p>
          )}
        </div>
      )}
      {hayCambios && (
        <Boton variante="fantasma" className="-ml-4" onClick={() => setValores(inicial)}>
          Volver a los valores del lote
        </Boton>
      )}
    </section>
  );
}

// -------------------------------------------------------------------- ficha
/** Todo sobre un lote: resultado, decisión, factores, simulador, análisis e historial. */
export function FichaLote({
  resumen, variables, umbral, onDecidido,
}: {
  resumen: LoteResumen;
  variables: Variable[];
  umbral: number;
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

  return (
    <section aria-label="Ficha del lote" className="space-y-7">
      <header>
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-medium leading-tight">
          Lote {resumen.codigo} {resumen.es_demo && <InsigniaDemo />}
        </h2>
        <p className="mt-1 text-sm text-suave">
          {[resumen.tanque && `Tanque ${resumen.tanque}`, fechaRelativa(resumen.fecha), resumen.capturado_por && `Capturó ${resumen.capturado_por}`]
            .filter(Boolean)
            .join(", ")}
        </p>
      </header>

      {error && <ErrorCaja>{error}</ErrorCaja>}
      {!ficha && !error && <Cargando />}
      {ficha && sem && ficha.probabilidad !== null && (
        <>
          <div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-2xl font-medium leading-none tabular">{pct(ficha.probabilidad)}</p>
              <InsigniaSemaforo semaforo={sem} tam={12} />
            </div>
            <div className="mt-3">
              <BarraProbabilidad p={ficha.probabilidad} semaforo={sem} umbral={umbral} alto={8} />
            </div>
            <p className="mt-3 text-sm">{SEMAFORO[sem].significado}</p>
            <p className="mt-1 text-xs text-suave">{fraseProbabilidad(ficha.probabilidad)}</p>
          </div>

          {/* Decisión: lo que Sergio viene a hacer, arriba */}
          <div className="space-y-3 border-y border-linea py-4">
            <p className="text-sm">
              <span className="text-suave">Decisión actual: </span>
              <span className="font-medium">{ficha.decision_actual ?? "Sin decidir"}</span>
            </p>
            <label className="block text-sm">
              Comentario (opcional)
              <input
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                maxLength={1000}
                placeholder="Ej. Probarlo el viernes con la enóloga"
                className="campo mt-1 !min-h-10"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Boton disabled={guardando} onClick={() => decidir("Premium")}>Aprobar como Premium</Boton>
              <Boton variante="secundario" disabled={guardando} onClick={() => decidir("Mandar a cata")}>Mandar a cata</Boton>
              <Boton variante="secundario" disabled={guardando} onClick={() => decidir("Estándar")}>Estándar</Boton>
            </div>
            {aviso && <p role="status" className="text-sm text-verde">{aviso}</p>}
          </div>

          <Avisos avisos={ficha.advertencias} />
          <ListaRazones razones={ficha.razones} nota={ficha.nota} />
          <Simulador ficha={ficha} variables={variables} umbral={umbral} />

          <section>
            <Subtitulo>Análisis del lote</Subtitulo>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {variables.map((v) => {
                  const valor = ficha.valores[v.clave];
                  if (valor === undefined) return null;
                  const fuera = valor < v.rango_normal[0] || valor > v.rango_normal[1];
                  return (
                    <tr key={v.clave} className="border-t border-linea">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-suave">{v.nombre}</th>
                      <td className="py-1.5 pr-2 text-right tabular">
                        {num(valor, v.decimales)} <span className="text-suave">{v.unidad}</span>
                      </td>
                      <td className="w-24 py-1.5 text-right text-xs">
                        {fuera ? <span className="font-medium text-ambar">Fuera de rango</span> : <span className="text-suave">Normal</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {ficha.decisiones.length > 0 && (
            <section>
              <Subtitulo>Decisiones anteriores</Subtitulo>
              <ul className="mt-2 divide-y divide-linea border-y border-linea">
                {ficha.decisiones.map((d) => (
                  <li key={d.id} className="py-2 text-sm">
                    <p className="flex flex-wrap justify-between gap-x-3">
                      <span className="font-medium">{d.decision}</span>
                      <span className="text-xs text-suave">{d.quien || "Sin nombre"}, {fechaHora(d.fecha)}</span>
                    </p>
                    {d.comentario && <p className="mt-0.5 text-suave">“{d.comentario}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
