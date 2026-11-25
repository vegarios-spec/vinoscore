import { useId } from "react";
import type { Semaforo } from "./tipos";
import { SEMAFORO } from "./util";

export type TipoSello = Semaforo | "pendiente";

const TINTA: Record<TipoSello, string> = {
  verde: SEMAFORO.verde.ink,
  amarillo: SEMAFORO.amarillo.ink,
  rojo: SEMAFORO.rojo.ink,
  pendiente: "#1b3a57",
};

/** Color de relleno de las versiones pequeñas. */
const RELLENO: Record<TipoSello, string> = { verde: "#4e8b3a", amarillo: "#e0a11b", rojo: "#c0392b", pendiente: "#ffffff" };

const TEXTO: Record<TipoSello, string> = {
  verde: "PROMETEDOR",
  amarillo: "REVISAR EN CATA",
  rojo: "ESTÁNDAR",
  pendiente: "PENDIENTE DE ENVIAR",
};

/** Borde dentado fino, como el de un sello de timbre o un billete. */
function dientes(r: number, amplitud: number, picos: number, puntos = 480): string {
  let d = "";
  for (let i = 0; i <= puntos; i++) {
    const t = (i / puntos) * 2 * Math.PI;
    const rr = r + amplitud * Math.cos(picos * t);
    const x = 120 + rr * Math.sin(t);
    const y = 120 - rr * Math.cos(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const BORDE_GRANDE = dientes(112, 2.6, 72);
const BORDE_MINI = dientes(110, 6, 16, 200);

/** El dibujo de cada estado (check, aviso, raya, puntos) centrado en (0, 0). */
function Glifo({ tipo, color, grosor }: { tipo: TipoSello; color: string; grosor: number }) {
  const p = { fill: "none", stroke: color, strokeWidth: grosor, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tipo === "verde") return <path d="M-30 4 L-10 26 L32 -24" {...p} />;
  if (tipo === "amarillo")
    return (
      <>
        <path d="M0 -30 L0 8" {...p} />
        <circle cx={0} cy={28} r={grosor * 0.55} fill={color} />
      </>
    );
  if (tipo === "rojo") return <path d="M-26 0 L26 0" {...p} />;
  return (
    <>
      {[-24, 0, 24].map((x) => (
        <circle key={x} cx={x} cy={0} r={grosor * 0.6} fill={color} />
      ))}
    </>
  );
}

/** Sello pequeño para listas: borde dentado de color y el dibujo, sin texto. */
export function SelloMini({ tipo, tam = 40 }: { tipo: TipoSello; tam?: number }) {
  const tinta = TINTA[tipo];
  const glifo = tipo === "amarillo" ? "#3d2a00" : "#ffffff";
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 240 240"
      role="img"
      aria-label={tipo === "pendiente" ? "Pendiente de enviar" : SEMAFORO[tipo].etiqueta}
      className="shrink-0"
    >
      <path d={BORDE_MINI} fill={RELLENO[tipo]} stroke={tipo === "pendiente" ? tinta : "none"} strokeWidth={8} />
      <g transform="translate(120 120)">
        <Glifo tipo={tipo} color={tipo === "pendiente" ? tinta : glifo} grosor={20} />
      </g>
    </svg>
  );
}

/**
 * El sello grande del resultado, grabado en tinta: la palabra gira alrededor,
 * y al centro va cuántos de cada 100 lotes así resultan buenos.
 */
export function Sello({
  tipo, probabilidad, tam = 240, estampar = true, fondo = "#ffffff",
}: {
  tipo: TipoSello;
  probabilidad?: number;
  tam?: number;
  estampar?: boolean;
  fondo?: string;
}) {
  const id = useId().replace(/:/g, "");
  const tinta = TINTA[tipo];
  const texto = TEXTO[tipo];
  // Se repite la palabra para llenar el círculo (r ≈ 79 → ~496 px de arco).
  const repeticiones = Math.max(2, Math.round(490 / (texto.length * 13 + 40)));
  const vuelta = Array.from({ length: repeticiones }, () => texto).join("   ·   ") + "   ·   ";
  const de100 = probabilidad === undefined ? null : Math.round(probabilidad * 100);

  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 240 240"
      role="img"
      aria-label={
        tipo === "pendiente"
          ? "Sello: pendiente de enviar"
          : `Sello: ${SEMAFORO[tipo].etiqueta}${de100 !== null ? `, ${de100} de cada 100` : ""}`
      }
      className={estampar ? "sello-estampa" : "-rotate-3"}
    >
      <defs>
        <path id={`arco-${id}`} d="M120,120 m-79,0 a79,79 0 1,1 158,0 a79,79 0 1,1 -158,0" />
      </defs>
      <path d={BORDE_GRANDE} fill={fondo} stroke={tinta} strokeWidth={1.6} />
      <circle cx={120} cy={120} r={99} fill="none" stroke={tinta} strokeWidth={1.2} />
      <circle cx={120} cy={120} r={92} fill="none" stroke={tinta} strokeWidth={0.8} />
      <circle cx={120} cy={120} r={62} fill="none" stroke={tinta} strokeWidth={1} />
      <text fontSize={13} fontWeight={600} fill={tinta} letterSpacing={3.2} fontFamily="Inter Variable, Inter, sans-serif">
        <textPath href={`#arco-${id}`} startOffset="0" textLength={488} lengthAdjust="spacing">
          {vuelta}
        </textPath>
      </text>
      {de100 !== null ? (
        <>
          <g transform="translate(120 80) scale(0.38)">
            <Glifo tipo={tipo} color={tinta} grosor={9} />
          </g>
          <text x={120} y={139} textAnchor="middle" className="font-display" fontSize={56} fontWeight={500} fill={tinta}>
            {de100}
          </text>
          <text x={120} y={160} textAnchor="middle" fontSize={10.5} fontWeight={500} fill={tinta} letterSpacing={0.4}>
            de cada 100
          </text>
        </>
      ) : (
        <g transform="translate(120 120)">
          <Glifo tipo={tipo} color={tinta} grosor={10} />
        </g>
      )}
    </svg>
  );
}
