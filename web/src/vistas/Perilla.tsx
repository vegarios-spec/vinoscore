import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Configuracion, FilaPerilla, Perilla } from "../tipos";
import { Boton, Cargando, ErrorCaja, Tarjeta } from "../ui";
import { leerNumero, num, peso, pct } from "../util";

const compacto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 });

export function fraseDeFila(f: FilaPerilla): string {
  if (f.de_cada_100_premium === null) {
    return "Con esta regla no se marcaría ningún vino como Premium: ningún lote llega a ese nivel de probabilidad.";
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
  const W = 760, H = 330, M = { i: 70, d: 12, s: 34, b: 52 };
  const ancho = W - M.i - M.d, alto = H - M.s - M.b;
  const max = Math.max(...filas.map((f) => f.costo_por_100_lotes), 1);
  const paso = max / 4;
  const techo = paso * 4;
  const y = (v: number) => M.s + alto - (v / techo) * alto;
  const slot = ancho / filas.length;
  const bw = slot * 0.68;
  // El umbral activo puede no estar en la tabla (por ejemplo 0.6 sí, 0.62 no): se marca el más cercano.
  const activoCercano = filas.reduce((a, f) => (Math.abs(f.umbral - activo) < Math.abs(a.umbral - activo) ? f : a)).umbral;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label="Costo esperado por cada 100 lotes, según el umbral">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={M.i} x2={W - M.d} y1={y(paso * i)} y2={y(paso * i)} stroke="#d5dde5" strokeWidth={1} />
            <text x={M.i - 8} y={y(paso * i) + 4} textAnchor="end" fontSize={12} fill="#4a5a6a">
              {compacto.format(paso * i)}
            </text>
          </g>
        ))}
        {filas.map((f, i) => {
          const x = M.i + i * slot + (slot - bw) / 2;
          const yy = y(f.costo_por_100_lotes);
          const esRec = f.umbral === recomendado;
          const esSel = f.umbral === seleccionado;
          const etiqueta = `Umbral ${num(f.umbral, 2)}: costo ${peso(f.costo_por_100_lotes)} por cada 100 lotes${esRec ? ", el más barato" : ""}${f.umbral === activoCercano ? ", regla activa" : ""}`;
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
              <rect x={M.i + i * slot} y={M.s} width={slot} height={alto + M.b - 8} fill="transparent" />
              <rect
                x={x} y={yy} width={bw} height={Math.max(M.s + alto - yy, 1)} rx={3}
                fill={esRec ? "#0f7c7a" : "#6e8ca8"}
                stroke={esSel ? "#e09f3e" : "none"} strokeWidth={esSel ? 4 : 0}
              />
              {f.umbral === activoCercano && (
                <text
                  x={x + bw / 2} y={yy - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1b3a57"
                  stroke="#ffffff" strokeWidth={4} paintOrder="stroke"
                >
                  ▼ activa
                </text>
              )}
              <text
                x={x + bw / 2} y={H - M.b + 18} textAnchor="middle" fontSize={12}
                fontWeight={esSel ? 800 : 500} fill={esSel ? "#1b3a57" : "#4a5a6a"}
              >
                {num(f.umbral, 2)}
              </text>
            </g>
          );
        })}
        <text x={M.i + ancho / 2} y={H - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1b2733">
          Umbral: probabilidad mínima para marcar un lote como Premium
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-suave">
        <span><span aria-hidden className="mr-1 inline-block size-3 rounded-sm bg-turquesa" />Más barato (recomendado)</span>
        <span><span aria-hidden className="mr-1 inline-block size-3 rounded-sm bg-[#6e8ca8]" />Otros umbrales</span>
        <span><span aria-hidden className="mr-1 inline-block size-3 rounded-sm border-4 border-ambar" />El que estás viendo</span>
      </figcaption>
    </figure>
  );
}

// --------------------------------------------------------------------- vista
const MODOS = [
  {
    nombre: "Sello Premium", umbral: 0.6,
    texto: "Solo los lotes más seguros. Marca pocos vinos, pero casi todos son buenos.",
  },
  {
    nombre: "Filtro a cata", umbral: 0.3,
    texto: "Deja pasar casi todo lo que valga la pena probar. No se te escapa casi ningún vino bueno, pero habrá que catar más.",
  },
];

export function VistaPerilla({ onConfigCambia }: { onConfigCambia: () => void }) {
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [fp, setFp] = useState("");
  const [fn, setFn] = useState("");
  const [data, setData] = useState<Perilla | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .configuracion()
      .then((c) => {
        setCfg(c);
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

  const umbralVisto = elegido ?? data?.umbral_recomendado ?? null;
  const fila = useMemo(() => data?.filas.find((f) => f.umbral === umbralVisto) ?? null, [data, umbralVisto]);

  const activar = async (umbral: number, etiqueta: string) => {
    if (!costosValidos) return;
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
      setMensaje(`Regla activada: ${etiqueta}. El tablero ya usa el umbral ${num(umbral, 2)}.`);
      onConfigCambia();
    } catch {
      setError("No se pudo guardar la regla. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  if (!cfg && !error) return <Cargando />;

  return (
    <div className="space-y-5">
      <Tarjeta className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-marino">Perilla del dinero</h2>
          <p className="text-suave">
            Dile al sistema cuánto te cuesta equivocarte y te sugiere desde qué probabilidad conviene marcar un lote como Premium.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoPesos
            id="costo-fp"
            etiqueta="¿Cuánto le cuesta etiquetar Premium un vino que no lo es?"
            ayuda="Por lote. Ej.: devoluciones, mala reputación, margen perdido."
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
        <p className="text-sm text-suave">
          Los valores iniciales ($500 y $1,500) son de ejemplo: cámbialos por los costos reales de la bodega.
        </p>
      </Tarjeta>

      {error && <ErrorCaja>{error}</ErrorCaja>}

      {data && fila && umbralVisto !== null && (
        <Tarjeta className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-marino">Costo esperado por cada 100 lotes</h3>
              <p className="text-sm text-suave">Toca una barra para ver qué pasaría con ese umbral.</p>
            </div>
            <div className="rounded-xl bg-turquesa px-4 py-2 text-white">
              <p className="text-sm font-semibold">Umbral recomendado</p>
              <p className="text-3xl font-extrabold tabular">{num(data.umbral_recomendado, 2)}</p>
            </div>
          </div>

          <Grafica
            filas={data.filas}
            recomendado={data.umbral_recomendado}
            seleccionado={umbralVisto}
            activo={cfg?.umbral_activo ?? data.umbral_activo}
            onElegir={setElegido}
          />

          <div className="rounded-2xl border-2 border-ambar bg-white p-4">
            <h4 className="text-lg font-bold">
              Con el umbral {num(umbralVisto, 2)}
              {umbralVisto === data.umbral_recomendado && <span className="ml-2 text-turquesa">(el recomendado)</span>}
            </h4>
            <p className="mt-1 text-lg font-semibold text-marino">{fraseDeFila(fila)}</p>
            <ul className="mt-2 space-y-1 text-base">
              <li>
                De cada 100 lotes, se marcarían Premium unos <strong>{num(fila.marcados_premium_por_100, 1)}</strong>.
              </li>
              <li>
                Entre todos los lotes, unos <strong>{num(fila.falsos_premium_por_100, 1)}</strong> serían falsos Premium.
              </li>
              <li>
                Y unos <strong>{num(fila.buenos_perdidos_por_100, 1)}</strong> vinos buenos se venderían como estándar.
              </li>
              <li>
                Costo esperado: <strong>{peso(fila.costo_por_100_lotes)}</strong> por cada 100 lotes.
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Boton
                variante="secundario"
                disabled={guardando || !costosValidos || cfg?.umbral_activo === umbralVisto}
                onClick={() => activar(umbralVisto, `umbral ${num(umbralVisto, 2)}`)}
              >
                {cfg?.umbral_activo === umbralVisto ? "Esta regla ya está activa" : `Activar el umbral ${num(umbralVisto, 2)}`}
              </Boton>
              {elegido !== null && elegido !== data.umbral_recomendado && (
                <Boton variante="borde" onClick={() => setElegido(null)}>
                  Volver al recomendado
                </Boton>
              )}
            </div>
            {mensaje && (
              <p role="status" className="mt-2 font-semibold text-verde-texto">
                ✓ {mensaje}
              </p>
            )}
          </div>
          <p className="text-xs text-suave">
            {data.nota} Regla activa hoy: umbral {num(cfg?.umbral_activo ?? data.umbral_activo, 2)}.
          </p>
        </Tarjeta>
      )}

      <Tarjeta className="space-y-3">
        <h3 className="text-lg font-bold text-marino">Dos modos rápidos</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {MODOS.map((m) => {
            const esActivo = cfg?.umbral_activo === m.umbral;
            const filaModo = data?.filas.find((f) => f.umbral === m.umbral);
            return (
              <div key={m.nombre} className={`rounded-2xl border-2 p-4 ${esActivo ? "border-turquesa bg-white" : "border-borde"}`}>
                <p className="text-lg font-bold">
                  {m.nombre} <span className="text-suave">(umbral {num(m.umbral, 2)})</span>
                </p>
                <p className="mt-1 text-suave">{m.texto}</p>
                {filaModo && <p className="mt-2 font-semibold text-marino">{fraseDeFila(filaModo)}</p>}
                <Boton
                  variante={esActivo ? "borde" : "primario"}
                  className="mt-3"
                  disabled={guardando || !costosValidos || esActivo}
                  onClick={() => activar(m.umbral, m.nombre)}
                >
                  {esActivo ? "✓ Modo activo" : `Usar ${m.nombre}`}
                </Boton>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-suave">
          Regla activa ahora: Prometedor si la probabilidad es {pct(cfg?.umbral_activo ?? 0.5)} o más.
        </p>
      </Tarjeta>
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
      <div className="relative mt-1">
        <span aria-hidden className="absolute inset-y-0 left-3 flex items-center text-lg font-semibold text-suave">
          $
        </span>
        <input
          id={id}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          inputMode="decimal"
          className="min-h-13 w-full rounded-xl border-2 border-borde bg-white pl-8 pr-16 text-lg font-semibold tabular"
        />
        <span aria-hidden className="absolute inset-y-0 right-3 flex items-center text-sm text-suave">
          pesos
        </span>
      </div>
    </div>
  );
}
