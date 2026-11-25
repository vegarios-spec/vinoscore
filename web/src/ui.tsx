import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Razon, Semaforo } from "./tipos";
import { SEMAFORO, fraseProbabilidad } from "./util";

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-borde bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

type Variante = "primario" | "secundario" | "borde" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marino text-white hover:bg-marino-claro",
  secundario: "bg-turquesa text-white hover:bg-turquesa-oscuro",
  borde: "border border-marino bg-white text-marino hover:bg-fondo",
  peligro: "bg-rojo text-white hover:bg-rojo-texto",
};

export function Boton({
  variante = "primario", grande = false, className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors
        disabled:cursor-not-allowed disabled:opacity-50
        ${grande ? "min-h-14 text-lg" : "min-h-11 text-base"} ${VARIANTES[variante]} ${className}`}
    />
  );
}

/** Etiqueta pequeña del semáforo: punto de color + palabra. */
export function InsigniaSemaforo({ semaforo }: { semaforo: Semaforo | null }) {
  if (!semaforo) return <span className="text-suave">Sin evaluar</span>;
  const s = SEMAFORO[semaforo];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${s.fondo} ${s.texto}`}>
      <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded-full text-xs text-white ${s.relleno}`}>
        {s.icono}
      </span>
      {s.etiqueta}
    </span>
  );
}

export function InsigniaDemo() {
  return (
    <span className="rounded-md border border-ambar bg-amber-50 px-1.5 py-0.5 text-xs font-bold tracking-wide text-amber-900">
      DEMO
    </span>
  );
}

/** Semáforo grande con la palabra y la probabilidad dicha en palabras. */
export function SemaforoGrande({ semaforo, probabilidad }: { semaforo: Semaforo; probabilidad: number }) {
  const s = SEMAFORO[semaforo];
  return (
    <div className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${s.fondo} ${s.borde}`} role="status" aria-live="polite">
      <div
        aria-hidden
        className={`flex size-24 shrink-0 items-center justify-center rounded-full text-6xl font-extrabold text-white ${s.relleno}`}
      >
        {s.icono}
      </div>
      <div>
        <p className={`text-3xl font-extrabold leading-tight ${s.texto}`}>{s.etiqueta}</p>
        <p className="mt-1 text-base font-semibold text-tinta">{Math.round(probabilidad * 100)} de cada 100</p>
        <p className="mt-1 text-sm text-suave">{s.significado}</p>
      </div>
    </div>
  );
}

export function TextoProbabilidad({ p }: { p: number }) {
  return <p className="text-sm text-suave">{fraseProbabilidad(p)}</p>;
}

export function ListaRazones({ razones, nota }: { razones: Razon[]; nota?: string }) {
  return (
    <div>
      <h3 className="text-base font-bold text-marino">Por qué salió así</h3>
      <ul className="mt-2 space-y-2">
        {razones.map((r) => (
          <li key={r.variable} className="flex items-start gap-3 rounded-xl bg-fondo p-3">
            <span
              aria-hidden
              className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white
                ${r.efecto === "favorece" ? "bg-verde" : r.efecto === "resta" ? "bg-rojo" : "bg-suave"}`}
            >
              {r.efecto === "favorece" ? "+" : r.efecto === "resta" ? "−" : "·"}
            </span>
            <span className="text-base">{r.texto}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-suave">
        {nota ?? "Explicación aproximada: indica en qué se parece o se aleja el lote de un vino bueno típico."}
      </p>
    </div>
  );
}

export function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-amarillo bg-amarillo-claro p-3 text-amarillo-texto">
      <p className="font-bold">⚠ Revisa estos datos</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p className="mt-1 text-sm">El lote se guardó de todos modos.</p>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p role="status" className="py-8 text-center text-suave">
      {texto}
    </p>
  );
}

export function ErrorCaja({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-rojo bg-rojo-claro p-3 font-medium text-rojo-texto">
      {children}
    </div>
  );
}

/** Mensaje visible si no hay datos de demostración ni reales. */
export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-borde bg-white p-6 text-center text-suave">{children}</p>;
}
