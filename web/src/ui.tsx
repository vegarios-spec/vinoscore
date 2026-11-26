import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Razon, Semaforo } from "./tipos";
import { SEMAFORO } from "./util";

type Variante = "primario" | "secundario" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-primario text-sobre-primario hover:opacity-90",
  secundario: "border border-linea-fuerte bg-transparent text-texto hover:bg-realce",
  fantasma: "bg-transparent text-texto hover:bg-realce",
};
export function Boton({
  variante = "primario", grande = false, className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-40
        ${grande ? "min-h-14 text-base" : "min-h-10 text-sm"} ${VARIANTES[variante]} ${className}`}
    />
  );
}

const COLOR_MARCADOR: Record<Semaforo | "pendiente", string> = {
  verde: "bg-verde",
  amarillo: "bg-ambar",
  rojo: "bg-rojo",
  pendiente: "border border-suave bg-transparent",
};

/** Cuadro sólido del color del semáforo. Siempre acompaña a una palabra. */
export function Marcador({ tipo, tam = 10 }: { tipo: Semaforo | "pendiente"; tam?: number }) {
  return <span aria-hidden className={`inline-block shrink-0 ${COLOR_MARCADOR[tipo]}`} style={{ width: tam, height: tam }} />;
}

export function InsigniaSemaforo({ semaforo, tam = 10 }: { semaforo: Semaforo | null; tam?: number }) {
  if (!semaforo) return <span className="text-suave">Sin evaluar</span>;
  return (
    <span className="inline-flex items-center gap-2 font-medium text-texto">
      <Marcador tipo={semaforo} tam={tam} />
      {SEMAFORO[semaforo].etiqueta}
    </span>
  );
}

export function InsigniaDemo() {
  return (
    <span className="border border-linea-fuerte px-1 text-[0.6875rem] font-medium leading-4 text-suave" title="Dato de demostración">
      Demo
    </span>
  );
}

/**
 * Barra recta de 0 a 100 %. El relleno lleva el color del semáforo; las líneas
 * verticales marcan el umbral activo y, si se dan, otras referencias (p. ej. el valor original).
 */
export function BarraProbabilidad({
  p, semaforo, umbral, alto = 6, marcas = [],
}: { p: number; semaforo: Semaforo; umbral: number; alto?: number; marcas?: number[] }) {
  const relleno = { verde: "bg-verde", amarillo: "bg-ambar", rojo: "bg-rojo" }[semaforo];
  return (
    <div className="relative w-full bg-linea" style={{ height: alto }} aria-hidden>
      <div className={`h-full ${relleno}`} style={{ width: `${Math.round(p * 100)}%` }} />
      <span className="absolute -inset-y-1 w-px bg-texto" style={{ left: `${umbral * 100}%` }} />
      {marcas.map((m) => (
        <span key={m} className="absolute -inset-y-1 w-px bg-suave" style={{ left: `${m * 100}%` }} />
      ))}
    </div>
  );
}

/** Factores que más pesaron en el resultado. */
export function ListaRazones({ razones, nota }: { razones: Razon[]; nota?: string }) {
  return (
    <section>
      <h3 className="text-base font-medium text-texto">Factores principales</h3>
      <ul className="mt-2 divide-y divide-linea border-y border-linea">
        {razones.map((r) => (
          <li key={r.variable} className="flex items-baseline gap-3 py-2.5">
            <span
              aria-hidden
              className={`w-4 shrink-0 text-center font-semibold ${r.efecto === "favorece" ? "text-verde" : r.efecto === "resta" ? "text-rojo" : "text-suave"}`}
            >
              {r.efecto === "favorece" ? "+" : r.efecto === "resta" ? "−" : "·"}
            </span>
            <span className="text-sm">{r.texto}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-suave">
        {nota ?? "Explicación aproximada: indica en qué se parece o se aleja el lote de un vino bueno típico."}
      </p>
    </section>
  );
}

export function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <div role="alert" className="border-l-2 border-ambar bg-superficie px-4 py-3 text-sm">
      <p className="font-medium">Revisar estos datos</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-suave">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p className="mt-1 text-suave">El lote se guardó de todos modos.</p>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-suave">
      {texto}
    </p>
  );
}

export function ErrorCaja({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="border-l-2 border-rojo bg-superficie px-4 py-3 text-sm font-medium">
      {children}
    </div>
  );
}

/** Una zona vacía dice qué falta y qué hacer. */
export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="border border-linea px-6 py-10 text-center">
      <p className="text-base font-medium">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-suave">{children}</div>}
    </div>
  );
}
