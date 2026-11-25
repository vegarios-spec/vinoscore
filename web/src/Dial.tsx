import { useRef } from "react";
import { num } from "./util";

const MIN = 0.05;
const MAX = 0.95;
const PASO = 0.05;
const BARRIDO = 135; // la perilla gira de -135° a +135°

const C = 170; // centro del dibujo (viewBox 340)
const R_PISTA = 122;

const aGrados = (v: number) => -BARRIDO + ((v - MIN) / (MAX - MIN)) * 2 * BARRIDO;
const punto = (grados: number, r: number) => {
  const a = (grados * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};
const arco = (g0: number, g1: number, r: number) => {
  const a = punto(g0, r);
  const b = punto(g1, r);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${r} ${r} 0 ${g1 - g0 > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const ajustar = (v: number) => Number(Math.min(MAX, Math.max(MIN, Math.round(v / PASO) * PASO)).toFixed(2));

/**
 * La "perilla" del umbral: se gira arrastrando, con las flechas del teclado o
 * con los botones de los extremos. Funciona como un control deslizante circular.
 */
export function Dial({
  valor, onCambio, recomendado, activo, descripcion,
}: {
  valor: number;
  onCambio: (v: number) => void;
  recomendado: number | null;
  activo: number;
  descripcion: string; // lo que dice el lector de pantalla, p. ej. "de cada 100 marcados, 48 sí lo son"
}) {
  const svg = useRef<SVGSVGElement>(null);
  const g = aGrados(valor);

  const desdePuntero = (e: React.PointerEvent) => {
    const caja = svg.current?.getBoundingClientRect();
    if (!caja) return;
    const dx = e.clientX - (caja.left + caja.width / 2);
    const dy = e.clientY - (caja.top + caja.height / 2);
    const grados = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° arriba, a la derecha positivo
    const acotado = Math.max(-BARRIDO, Math.min(BARRIDO, grados));
    onCambio(ajustar(MIN + ((acotado + BARRIDO) / (2 * BARRIDO)) * (MAX - MIN)));
  };

  const teclado = (e: React.KeyboardEvent) => {
    const mapa: Record<string, number> = {
      ArrowRight: PASO, ArrowUp: PASO, ArrowLeft: -PASO, ArrowDown: -PASO, PageUp: 3 * PASO, PageDown: -3 * PASO,
    };
    if (e.key === "Home") onCambio(MIN);
    else if (e.key === "End") onCambio(MAX);
    else if (e.key in mapa) onCambio(ajustar(valor + mapa[e.key]));
    else return;
    e.preventDefault();
  };

  const marcas = Array.from({ length: 19 }, (_, i) => ajustar(MIN + i * PASO));
  const rec = recomendado === null ? null : punto(aGrados(recomendado), R_PISTA);
  const act = punto(aGrados(activo), 99); // entre el cuerpo de la perilla y la pista
  const aguja0 = punto(g, 40);
  const aguja1 = punto(g, 74);

  return (
    <svg
      ref={svg}
      viewBox="-24 -24 388 388"
      role="slider"
      tabIndex={0}
      aria-label="Umbral para marcar un lote como Premium"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={Number(valor.toFixed(2))}
      aria-valuetext={`${num(valor, 2)}. ${descripcion}`}
      onKeyDown={teclado}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        desdePuntero(e);
      }}
      onPointerMove={(e) => {
        if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) desdePuntero(e);
      }}
      className="mx-auto block aspect-square w-full max-w-[340px] cursor-grab touch-none select-none rounded-full active:cursor-grabbing"
    >
      {/* pista y tramo recorrido */}
      <path d={arco(-BARRIDO, BARRIDO, R_PISTA)} fill="none" stroke="#d3dbe3" strokeWidth={7} strokeLinecap="round" />
      {g > -BARRIDO && <path d={arco(-BARRIDO, g, R_PISTA)} fill="none" stroke="#11283d" strokeWidth={7} strokeLinecap="round" />}

      {/* marcas cada 0.05 y números en 0.25, 0.50 y 0.75 */}
      {marcas.map((m, i) => {
        const largo = i % 5 === 4 || i === 0 || i === 18 ? 12 : 7;
        const a = punto(aGrados(m), R_PISTA + 14);
        const b = punto(aGrados(m), R_PISTA + 14 + largo);
        return <line key={m} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7a8a9a" strokeWidth={i % 5 === 4 ? 2 : 1} strokeLinecap="round" />;
      })}
      {[0.25, 0.5, 0.75].map((m) => {
        const p = punto(aGrados(m), R_PISTA + 38);
        return (
          <text key={m} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#4a5a6a" className="tabular">
            {num(m, 2)}
          </text>
        );
      })}

      {/* regla activa hoy */}
      <path d="M0 -9 l-7 12 l14 0 z" fill="#4a5a6a" transform={`translate(${act.x} ${act.y}) rotate(${aGrados(activo)})`} />

      {/* umbral recomendado */}
      {rec && (
        <g transform={`translate(${rec.x} ${rec.y}) rotate(45)`}>
          <rect x={-7} y={-7} width={14} height={14} rx={2} fill="#b98a3e" stroke="#fff" strokeWidth={3} />
        </g>
      )}

      {/* el cuerpo de la perilla */}
      <circle cx={C} cy={C} r={90} fill="#11283d" />
      <circle cx={C} cy={C} r={89} fill="none" stroke="#b98a3e" strokeWidth={1.6} />
      <circle cx={C} cy={C} r={82} fill="none" stroke="#2c5478" strokeWidth={1} />
      <line x1={aguja0.x} y1={aguja0.y} x2={aguja1.x} y2={aguja1.y} stroke="#d9b06a" strokeWidth={4} strokeLinecap="round" />
      <text x={C} y={C + 4} textAnchor="middle" className="font-display tabular" fontSize={32} fontWeight={400} fill="#fff" pointerEvents="none">
        {num(valor, 2)}
      </text>
      <text x={C} y={C + 24} textAnchor="middle" fontSize={11} fontWeight={500} fill="#aab9c8" letterSpacing={0.6} pointerEvents="none">
        umbral
      </text>
    </svg>
  );
}
