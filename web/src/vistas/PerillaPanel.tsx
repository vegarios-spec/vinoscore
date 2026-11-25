import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Dial } from "../Dial";
import { Panel } from "../Panel";
import type { Configuracion, FilaPerilla, Perilla } from "../tipos";
import { Boton, Cargando, ErrorCaja } from "../ui";
import { leerNumero, num, peso } from "../util";

const compacto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 });
const igual = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export function fraseDeFila(f: FilaPerilla): string {
  if (f.de_cada_100_premium === null) {
    return "Con esta regla no se marcaría ningún vino como Premium: ningún lote llega a ese nivel.";
  }
  return `Con esta regla, de cada 100 vinos marcados Premium, ${f.de_cada_100_premium} sí lo son.`;
}

// ------------------------------------------------------------------- gráfica
function Grafica({
  filas, recomendado, seleccionado, activo, onElegir,
}: {
  filas: FilaPerilla[];
  recomendado: number;
  seleccionado: number;
  activo: number;
  onElegir: (u: number) => void;
}) {
  const W = 680, H = 250, M = { i: 62, d: 8, s: 28, b: 34 };
  const ancho = W - M.i - M.d, alto = H - M.s - M.b;
  const max = Math.max(...filas.map((f) => f.costo_por_100_lotes), 1);
  const paso = max / 3;
  const techo = paso * 3;
  const y = (v: number) => M.s + alto - (v / techo) * alto;
  const slot = ancho / filas.length;
  const bw = slot * 0.7;
  const activoCercano = filas.reduce((a, f) => (Math.abs(f.umbral - activo) < Math.abs(a.umbral - activo) ? f : a)).umbral;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label="Costo esperado por cada 100 lotes, según el umbral">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1={M.i} x2={W - M.d} y1={y(paso * i)} y2={y(paso * i)} stroke="#cfd9e1" strokeWidth={1} />
            <text x={M.i - 8} y={y(paso * i) + 4} textAnchor="end" fontSize={11.5} fill="#4a5a6a">
              {compacto.format(paso * i)}
            </text>
          </g>
        ))}
        {filas.map((f, i) => {
          const x = M.i + i * slot + (slot - bw) / 2;
          const yy = y(f.costo_por_100_lotes);
          const esRec = igual(f.umbral, recomendado);
          const esSel = igual(f.umbral, seleccionado);
          const etiqueta = `Umbral ${num(f.umbral, 2)}: ${peso(f.costo_por_100_lotes)} por cada 100 lotes${esRec ? ", el más barato" : ""}${igual(f.umbral, activoCercano) ? ", regla activa" : ""}`;
          return (
            <g
              key={f.umbral}
              role="button"
              tabIndex={0}
              aria-label={etiqueta}
              aria-pressed={esSel}
              onClick={() => onElegir(f.umbral)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onElegir(f.umbral);
                }
              }}
              className="cursor-pointer"
            >
              <title>{etiqueta}</title>
              <rect x={M.i + i * slot} y={M.s - 4} width={slot} height={alto + M.b} fill="transparent" />
              <rect
                x={x} y={yy} width={bw} height={Math.max(M.s + alto - yy, 1)} rx={3}
                fill={esSel ? "#11283d" : esRec ? "#0f7c7a" : "#9fb3c6"}
              />
              {esRec && <rect x={x + bw / 2 - 4} y={yy - 14} width={8} height={8} rx={1} transform={`rotate(45 ${x + bw / 2} ${yy - 10})`} fill="#b98a3e" stroke="#fff" strokeWidth={1.5} />}
              <text x={x + bw / 2} y={H - M.b + 16} textAnchor="middle" fontSize={11} fontWeight={esSel ? 800 : 500} fill={esSel ? "#11283d" : "#4a5a6a"}>
                {num(f.umbral, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-suave">
        <span><span aria-hidden className="mr-1.5 inline-block size-3 rounded-sm bg-turquesa" />El más barato</span>
        <span><span aria-hidden className="mr-1.5 inline-block size-3 rounded-sm bg-noche" />El que estás probando</span>
        <span><span aria-hidden className="mr-1.5 inline-block size-3 rotate-45 rounded-[2px] bg-laton" />Recomendado</span>
      </figcaption>
    </figure>
  );
}

// --------------------------------------------------------------------- panel
const MODOS = [
  { nombre: "Filtro a cata", umbral: 0.3, texto: "Deja pasar casi todo lo que valga la pena probar" },
  { nombre: "Sello Premium", umbral: 0.6, texto: "Solo los lotes más seguros" },
];

export function PerillaPanel({
  onCerrar, onConfigCambia,
}: {
  onCerrar: () => void;
  onConfigCambia: (c: Configuracion) => void;
}) {
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [fp, setFp] = useState("");
  const [fn, setFn] = useState("");
  const [data, setData] = useState<Perilla | null>(null);
  const [umbral, setUmbral] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .configuracion()
      .then((c) => {
        setCfg(c);
        setUmbral(c.umbral_activo);
        setFp(String(c.costo_falso_premium));
        setFn(String(c.costo_bueno_perdido));
      })
      .catch(() => setError("No se pudo cargar la configuración."));
  }, []);

  const costoFp = leerNumero(fp);
  const costoFn = leerNumero(fn);
  const costosValidos = costoFp !== null && costoFn !== null && costoFp >= 0 && costoFn >= 0;

  useEffect(() => {
    if (!costosValidos) return;
    let vigente = true;
    const t = setTimeout(() => {
      api
        .perilla(costoFp as number, costoFn as number)
        .then((d) => {
          if (!vigente) return;
          setData(d);
          setError(null);
        })
        .catch(() => vigente && setError("No se pudo calcular la perilla."));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [costoFp, costoFn, costosValidos]);

  // Si la regla activa no coincide con ninguna fila de la tabla (0.05 a 0.95), la perilla salta a la más cercana.
  useEffect(() => {
    if (!data || umbral === null || data.filas.some((f) => igual(f.umbral, umbral))) return;
    setUmbral(data.filas.reduce((a, f) => (Math.abs(f.umbral - umbral) < Math.abs(a.umbral - umbral) ? f : a)).umbral);
  }, [data, umbral]);

  const fila = useMemo(() => (data && umbral !== null ? data.filas.find((f) => igual(f.umbral, umbral)) ?? null : null), [data, umbral]);
  const yaActiva = cfg !== null && umbral !== null && igual(cfg.umbral_activo, umbral);

  const activar = async () => {
    if (!costosValidos || umbral === null) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const c = await api.guardarConfiguracion({
        umbral_activo: umbral,
        costo_falso_premium: costoFp as number,
        costo_bueno_perdido: costoFn as number,
        actualizado_por: "Sergio",
      });
      setCfg(c);
      setMensaje(`Regla activada: Prometedor desde ${num(umbral, 2)}.`);
      onConfigCambia(c);
    } catch {
      setError("No se pudo guardar la regla. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const diferenciaCosto = data && fila ? fila.costo_por_100_lotes - data.recomendado.costo_por_100_lotes : 0;

  return (
    <Panel
      titulo="La perilla del dinero"
      subtitulo="Dile a VinoScore cuánto te cuesta equivocarte y gira la perilla hasta una regla que te convenga."
      onCerrar={onCerrar}
      pie={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="min-w-0 flex-1 text-sm font-semibold text-verde-texto">
            {mensaje}
          </p>
          <Boton variante="secundario" disabled={guardando || !costosValidos || umbral === null || yaActiva} onClick={activar}>
            {yaActiva ? "Esta regla ya está activa" : umbral !== null ? `Activar el umbral ${num(umbral, 2)}` : "Activar"}
          </Boton>
        </div>
      }
    >
      {!cfg && !error && <Cargando />}
      {error && <div className="p-5"><ErrorCaja>{error}</ErrorCaja></div>}
      {cfg && (
        <div className="space-y-9 p-5 pb-8">
          <section aria-labelledby="costos" className="space-y-4">
            <h3 id="costos" className="font-display text-[1.6rem] font-medium leading-tight text-marino">Lo que te cuesta equivocarte</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <CampoPesos
                id="costo-fp"
                etiqueta="¿Cuánto le cuesta etiquetar Premium un vino que no lo es?"
                ayuda="Por lote. Piensa en devoluciones, mala fama o margen perdido."
                valor={fp}
                onCambio={setFp}
              />
              <CampoPesos
                id="costo-fn"
                etiqueta="¿Cuánto pierde si un vino bueno se vende como estándar?"
                ayuda="Por lote. Es la diferencia de precio que dejas de ganar."
                valor={fn}
                onCambio={setFn}
              />
            </div>
            {!costosValidos && <ErrorCaja>Escribe los dos costos como números de cero o más.</ErrorCaja>}
            <p className="text-sm text-suave">Los costos iniciales ($500 y $1,500) son de ejemplo. Cámbialos por los de tu bodega.</p>
          </section>

          {data && fila && umbral !== null ? (
            <>
              <section aria-labelledby="gira" className="space-y-4">
                <h3 id="gira" className="font-display text-[1.6rem] font-medium leading-tight text-marino">Gira hasta la regla que quieras</h3>
                <div className="flex flex-wrap gap-2">
                  {MODOS.map((m) => (
                    <button
                      key={m.nombre}
                      onClick={() => setUmbral(m.umbral)}
                      aria-pressed={igual(umbral, m.umbral)}
                      title={m.texto}
                      className={`min-h-11 rounded-lg px-4 font-semibold ${igual(umbral, m.umbral) ? "bg-noche text-white" : "bg-hielo text-marino hover:bg-borde"}`}
                    >
                      {m.nombre} <span className="font-medium opacity-80">{num(m.umbral, 2)}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setUmbral(data.umbral_recomendado)}
                    aria-pressed={igual(umbral, data.umbral_recomendado)}
                    className={`min-h-11 rounded-lg px-4 font-semibold ${igual(umbral, data.umbral_recomendado) ? "bg-ambar-claro text-amber-900 ring-1 ring-laton" : "bg-white text-amber-900 ring-1 ring-laton/50 hover:bg-ambar-claro"}`}
                  >
                    El más barato <span className="font-medium">{num(data.umbral_recomendado, 2)}</span>
                  </button>
                </div>

                <div className="grid items-center gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
                  <div>
                    <Dial
                      valor={umbral}
                      onCambio={setUmbral}
                      recomendado={data.umbral_recomendado}
                      activo={cfg.umbral_activo}
                      descripcion={fraseDeFila(fila)}
                    />
                    <div className="mx-auto mt-1 flex max-w-[320px] justify-between gap-2">
                      <button onClick={() => setUmbral((u) => Math.max(0.05, Math.round(((u ?? 0.5) - 0.05) * 20) / 20))} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-marino hover:bg-hielo">
                        <span aria-hidden>‹ </span>Catar más
                      </button>
                      <button onClick={() => setUmbral((u) => Math.min(0.95, Math.round(((u ?? 0.5) + 0.05) * 20) / 20))} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-marino hover:bg-hielo">
                        Solo los seguros<span aria-hidden> ›</span>
                      </button>
                    </div>
                  </div>

                  <div aria-live="polite" className="space-y-4">
                    <p className="font-display text-[1.85rem] font-normal leading-[1.12] text-marino">{fraseDeFila(fila)}</p>
                    <dl className="grid grid-cols-3 gap-3 border-t border-borde pt-4">
                      <Dato valor={num(fila.marcados_premium_por_100, 1)} texto="lotes marcados Premium, de cada 100" />
                      <Dato valor={num(fila.falsos_premium_por_100, 1)} texto="serían falsos Premium" />
                      <Dato valor={num(fila.buenos_perdidos_por_100, 1)} texto="vinos buenos se irían como estándar" />
                    </dl>
                    <p className="text-base">
                      Costo esperado: <strong>{peso(fila.costo_por_100_lotes)}</strong> por cada 100 lotes.
                      {diferenciaCosto > 0.5 && (
                        <span className="text-suave"> Es {peso(diferenciaCosto)} más que con la regla más barata.</span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <section aria-labelledby="costo-umbral" className="space-y-2">
                <h3 id="costo-umbral" className="font-display text-[1.6rem] font-medium leading-tight text-marino">Cuánto cuesta cada regla</h3>
                <p className="text-sm text-suave">Toca una barra para probar ese umbral en la perilla.</p>
                <Grafica filas={data.filas} recomendado={data.umbral_recomendado} seleccionado={umbral} activo={cfg.umbral_activo} onElegir={setUmbral} />
                <p className="text-xs text-suave">{data.nota}</p>
              </section>
            </>
          ) : (
            costosValidos && !error && <Cargando texto="Calculando…" />
          )}
        </div>
      )}
    </Panel>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div>
      <dd className="font-display text-[2.4rem] font-normal leading-none text-marino tabular">{valor}</dd>
      <dt className="mt-1 text-sm text-suave">{texto}</dt>
    </div>
  );
}

function CampoPesos({
  id, etiqueta, ayuda, valor, onCambio,
}: { id: string; etiqueta: string; ayuda: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {etiqueta}
      </label>
      <p className="text-sm text-suave">{ayuda}</p>
      <div className="relative mt-1.5">
        <span aria-hidden className="absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-suave">$</span>
        <input id={id} value={valor} onChange={(e) => onCambio(e.target.value)} inputMode="decimal" className="campo tabular !pl-9 !pr-16 font-semibold" />
        <span aria-hidden className="absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-suave">pesos</span>
      </div>
    </div>
  );
}
