import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "../api";
import type { Configuracion, FilaPerilla, Perilla } from "../tipos";
import { Boton } from "../ui";
import { leerPesos, num, peso, pesosCampo } from "../util";

const compacto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 });
const igual = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const redondear = (u: number) => Math.min(0.95, Math.max(0.05, Math.round(u * 20) / 20));

const MODOS = [
  { nombre: "Filtro a cata", umbral: 0.3, texto: "Deja pasar casi todo lo que valga la pena catar" },
  { nombre: "Sello Premium", umbral: 0.6, texto: "Solo los lotes más seguros" },
];

export function fraseDeFila(f: FilaPerilla): string {
  if (f.de_cada_100_premium === null) {
    return "Con esta regla ningún vino se marcaría como Premium: ningún lote llega a ese nivel.";
  }
  return `De cada 100 vinos marcados Premium, ${f.de_cada_100_premium} sí lo son.`;
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
  const W = 420, H = 150, M = { i: 48, d: 2, s: 8, b: 24 };
  const ancho = W - M.i - M.d, alto = H - M.s - M.b;
  const max = Math.max(...filas.map((f) => f.costo_por_100_lotes), 1);
  const paso = max / 3;
  const y = (v: number) => M.s + alto - (v / (paso * 3)) * alto;
  const slot = ancho / filas.length;
  const bw = slot * 0.66;
  const activoCercano = filas.reduce((a, f) => (Math.abs(f.umbral - activo) < Math.abs(a.umbral - activo) ? f : a)).umbral;

  // Una sola parada de Tab para toda la gráfica: las flechas recorren los umbrales.
  const iSel = Math.max(0, filas.findIndex((f) => igual(f.umbral, seleccionado)));
  const svg = useRef<SVGSVGElement>(null);
  const moverFoco = useRef(false);
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    svg.current?.querySelector<SVGGElement>(`[data-indice="${iSel}"]`)?.focus();
  }, [iSel]);
  const teclas = (e: KeyboardEvent<SVGGElement>, i: number) => {
    const destino = { ArrowLeft: i - 1, ArrowDown: i - 1, ArrowRight: i + 1, ArrowUp: i + 1, Home: 0, End: filas.length - 1 }[e.key];
    if (destino !== undefined) {
      e.preventDefault();
      const j = Math.min(filas.length - 1, Math.max(0, destino));
      moverFoco.current = j !== iSel;
      onElegir(filas[j].umbral);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onElegir(filas[i].umbral);
    }
  };

  return (
    <figure className="min-w-0">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full" role="radiogroup" aria-label="Costo esperado por cada 100 lotes, según el umbral. Usa las flechas para cambiar de umbral.">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1={M.i} x2={W - M.d} y1={y(paso * i)} y2={y(paso * i)} stroke="var(--linea)" strokeWidth={1} />
            <text x={M.i - 6} y={y(paso * i) + 4} textAnchor="end" fontSize={11} fill="var(--suave)">
              {compacto.format(paso * i)}
            </text>
          </g>
        ))}
        {filas.map((f, i) => {
          const x = M.i + i * slot + (slot - bw) / 2;
          const yy = y(f.costo_por_100_lotes);
          const esRec = igual(f.umbral, recomendado);
          const esSel = igual(f.umbral, seleccionado);
          const esActivo = igual(f.umbral, activoCercano);
          const etiqueta = `Umbral ${num(f.umbral, 2)}: ${peso(f.costo_por_100_lotes)} por cada 100 lotes${esRec ? ", el más barato" : ""}${esActivo ? ", regla activa" : ""}`;
          return (
            <g
              key={f.umbral}
              data-indice={i}
              role="radio"
              tabIndex={i === iSel ? 0 : -1}
              aria-label={etiqueta}
              aria-checked={esSel}
              onClick={() => onElegir(f.umbral)}
              onKeyDown={(e) => teclas(e, i)}
              className="cursor-pointer"
            >
              <title>{etiqueta}</title>
              <rect className="foco" x={M.i + i * slot + 0.5} y={M.s + 0.5} width={slot - 1} height={alto + M.b - 1} fill="transparent" />
              <rect
                x={x} y={yy} width={bw} height={Math.max(M.s + alto - yy, 1)}
                fill={esSel ? "var(--texto)" : esRec ? "var(--suave)" : "var(--linea-fuerte)"}
              />
              {i % 2 === 1 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill={esSel ? "var(--texto)" : "var(--suave)"} fontWeight={esSel ? 600 : 400}>
                  {num(f.umbral, 2)}
                </text>
              )}
              {esActivo && <rect x={x} y={M.s + alto + 2} width={bw} height={2} fill="var(--texto)" />}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 bg-texto" />Umbral elegido</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 bg-suave" />Más barato</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-2.5 bg-texto" />Regla activa</span>
      </figcaption>
    </figure>
  );
}

function CampoPesos({
  id, etiqueta, ayuda, valor, onCambio,
}: { id: string; etiqueta: string; ayuda: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{etiqueta}</label>
      <p id={`${id}-ayuda`} className="text-xs text-suave">{ayuda}</p>
      <div className="relative mt-1.5">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-suave">$</span>
        <input
          id={id}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={`${id}-ayuda`}
          aria-invalid={leerPesos(valor) === null || undefined}
          className="campo !min-h-10 !pl-7 !pr-14"
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-suave">MXN</span>
      </div>
    </div>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    // dt antes que dd (orden correcto para lectores de pantalla); se ve la cifra arriba con flex-col-reverse.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="mt-1.5 text-xs text-suave">{texto}</dt>
      <dd className="text-xl font-medium leading-none tabular">{valor}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------- banda
/**
 * Regla de decisión, siempre a la vista: costos, umbral (control deslizante y modos
 * rápidos), lo que implica el umbral elegido, el costo de cada umbral y el botón para activarlo.
 */
export function Regla({ onConfigCambia }: { onConfigCambia: (c: Configuracion) => void }) {
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [fp, setFp] = useState("");
  const [fn, setFn] = useState("");
  const [data, setData] = useState<Perilla | null>(null);
  const [umbral, setUmbral] = useState<number | null>(null);
  const [errorCfg, setErrorCfg] = useState<string | null>(null);
  const [errorCalc, setErrorCalc] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .configuracion()
      .then((c) => {
        setCfg(c);
        setUmbral(redondear(c.umbral_activo));
        setFp(pesosCampo(c.costo_falso_premium));
        setFn(pesosCampo(c.costo_bueno_perdido));
      })
      .catch(() => setErrorCfg("No se pudo cargar la regla activa."));
  }, []);

  const costoFp = leerPesos(fp);
  const costoFn = leerPesos(fn);
  const costosValidos = costoFp !== null && costoFn !== null;

  useEffect(() => {
    if (!costosValidos) return;
    let vigente = true;
    const t = setTimeout(() => {
      api
        .perilla(costoFp as number, costoFn as number)
        .then((d) => {
          if (!vigente) return;
          setData(d);
          setErrorCalc(null);
        })
        .catch(() => vigente && setErrorCalc("No se pudo calcular la regla."));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [costoFp, costoFn, costosValidos]);

  const fila = useMemo(() => (data && umbral !== null ? data.filas.find((f) => igual(f.umbral, umbral)) ?? null : null), [data, umbral]);
  const yaActiva = cfg !== null && umbral !== null && igual(cfg.umbral_activo, umbral);

  const activar = async () => {
    if (!costosValidos || umbral === null) return;
    setGuardando(true);
    setMensaje(null);
    setErrorGuardar(null);
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
      setErrorGuardar("No se pudo guardar la regla. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const elegir = (u: number) => {
    setUmbral(redondear(u));
    setMensaje(null);
    setErrorGuardar(null);
  };
  const diferencia = data && fila ? fila.costo_por_100_lotes - data.recomendado.costo_por_100_lotes : 0;

  return (
    <section aria-labelledby="regla-titulo" className="border-b border-linea bg-superficie">
      <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="regla-titulo" className="text-lg font-medium">Regla de decisión</h2>
          <p className="text-sm text-suave">
            {cfg && <>Activa: Prometedor desde <strong className="font-medium text-texto tabular">{num(cfg.umbral_activo, 2)}</strong></>}
          </p>
        </div>

        {errorCfg && (
          <p role="alert" className="mt-3 border-l-2 border-rojo pl-3 text-sm font-medium">
            {errorCfg} Revisa que el servidor esté encendido y recarga la página.
          </p>
        )}

        {/* Sin la regla activa no hay qué ajustar: solo se muestra el aviso de arriba. */}
        {!errorCfg && (
        <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,1.3fr)]">
          {/* Costos */}
          <div className="space-y-3">
            <CampoPesos id="costo-fp" etiqueta="Costo de un falso Premium" ayuda="Por lote: devoluciones, reputación o margen perdido." valor={fp} onCambio={setFp} />
            <CampoPesos id="costo-fn" etiqueta="Costo de un buen vino vendido como estándar" ayuda="Por lote: diferencia de precio que se deja de ganar." valor={fn} onCambio={setFn} />
            {!cfg ? null : costosValidos ? (
              <p className="text-xs text-suave">Los valores iniciales son de ejemplo. Reemplázalos por los de la bodega.</p>
            ) : (
              <p role="alert" className="text-xs font-medium text-rojo">Escribe los dos costos como cantidades de cero o más, por ejemplo 1,500.</p>
            )}
          </div>

          {/* Umbral */}
          <div className="min-w-0">
            <div className="flex items-baseline justify-between">
              <label htmlFor="umbral" className="text-sm font-medium">Umbral</label>
              <span className="text-2xl font-medium leading-none tabular">{umbral !== null ? num(umbral, 2) : "–"}</span>
            </div>
            <input
              id="umbral"
              type="range"
              min={0.05}
              max={0.95}
              step={0.05}
              value={umbral ?? 0.5}
              disabled={umbral === null}
              onChange={(e) => elegir(Number(e.target.value))}
              aria-label="Umbral"
              aria-valuetext={umbral !== null ? `Prometedor desde ${num(umbral, 2)}` : undefined}
              className="mt-3 h-6 w-full"
            />
            <div className="flex justify-between text-xs text-suave">
              <span>Catar más</span>
              <span>Solo los seguros</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {MODOS.map((m) => (
                <button
                  key={m.nombre}
                  onClick={() => elegir(m.umbral)}
                  aria-pressed={umbral !== null && igual(umbral, m.umbral)}
                  title={m.texto}
                  className="min-h-9 border border-linea-fuerte px-3 text-sm hover:bg-realce aria-pressed:border-texto aria-pressed:bg-texto aria-pressed:text-fondo"
                >
                  {m.nombre} <span className="tabular opacity-70">{num(m.umbral, 2)}</span>
                </button>
              ))}
              {data && (
                <button
                  onClick={() => elegir(data.umbral_recomendado)}
                  aria-pressed={umbral !== null && igual(umbral, data.umbral_recomendado)}
                  title="El umbral con el menor costo esperado según los costos de arriba"
                  className="min-h-9 border border-linea-fuerte px-3 text-sm hover:bg-realce aria-pressed:border-texto aria-pressed:bg-texto aria-pressed:text-fondo"
                >
                  Más barato <span className="tabular opacity-70">{num(data.umbral_recomendado, 2)}</span>
                </button>
              )}
            </div>
          </div>

          {/* Lo que implica */}
          <div aria-live="polite" className="min-w-0">
            {errorCalc && <p role="alert" className="border-l-2 border-rojo pl-3 text-sm font-medium">{errorCalc}</p>}
            {fila && (
              <>
                <p className="text-sm">{fraseDeFila(fila)}</p>
                <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-linea pt-3">
                  <Dato valor={num(fila.marcados_premium_por_100, 1)} texto="marcados Premium de cada 100" />
                  <Dato valor={num(fila.falsos_premium_por_100, 1)} texto="falsos Premium" />
                  <Dato valor={num(fila.buenos_perdidos_por_100, 1)} texto="buenos vendidos como estándar" />
                </dl>
                <p className="mt-3 border-t border-linea pt-3 text-sm">
                  Costo esperado <strong id="costo-esperado" className="text-base font-medium tabular">{peso(fila.costo_por_100_lotes)}</strong>{" "}
                  <span className="text-suave">por cada 100 lotes</span>
                </p>
                {diferencia > 0.5 && <p className="text-xs text-suave">{peso(diferencia)} más que el umbral más barato.</p>}
              </>
            )}
          </div>

          {/* Costo por umbral y activar */}
          <div className="min-w-0">
            {data && umbral !== null && cfg ? (
              <Grafica filas={data.filas} recomendado={data.umbral_recomendado} seleccionado={umbral} activo={cfg.umbral_activo} onElegir={elegir} />
            ) : (
              !errorCalc && <p role="status" className="text-sm text-suave">Calculando…</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Boton disabled={guardando || !costosValidos || umbral === null || yaActiva} onClick={activar}>
                {yaActiva ? "Esta regla ya está activa" : umbral !== null ? `Activar umbral ${num(umbral, 2)}` : "Activar"}
              </Boton>
              <p role="status" className="text-sm text-verde">{mensaje}</p>
            </div>
            {errorGuardar && <p role="alert" className="mt-2 border-l-2 border-rojo pl-3 text-sm font-medium">{errorGuardar}</p>}
            {data && <p className="mt-2 text-xs text-suave">{data.nota}</p>}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
