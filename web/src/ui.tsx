import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Razon, Semaforo } from "./tipos";
import { SelloMini } from "./Sello";
import { SEMAFORO } from "./util";

type Variante = "primario" | "secundario" | "ambar" | "borde" | "claro";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marino text-white hover:bg-noche",
  secundario: "bg-turquesa text-white hover:bg-turquesa-oscuro",
  // "Ambar" ahora es el botón de latón: blanco con filete dorado
  ambar: "border border-laton bg-white text-noche hover:bg-ambar-claro",
  borde: "border border-marino bg-transparent text-marino hover:bg-hielo",
  claro: "bg-hielo text-marino hover:bg-borde",
};

export function Boton({
  variante = "primario", grande = false, className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 font-semibold tracking-[0.01em] transition
        disabled:cursor-not-allowed disabled:opacity-45
        ${grande ? "min-h-14 text-lg" : "min-h-11 text-[0.95rem]"} ${VARIANTES[variante]} ${className}`}
    />
  );
}

/** Semáforo en una línea: sello pequeño y la palabra. */
export function InsigniaSemaforo({ semaforo, tam = 28 }: { semaforo: Semaforo | null; tam?: number }) {
  if (!semaforo) return <span className="text-suave">Sin evaluar</span>;
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${SEMAFORO[semaforo].texto}`}>
      <SelloMini tipo={semaforo} tam={tam} />
      {SEMAFORO[semaforo].etiqueta}
    </span>
  );
}

export function InsigniaDemo() {
  return (
    <span className="rounded border border-laton px-1.5 py-px text-[0.68rem] font-semibold tracking-[0.12em] text-amber-900">
      DEMO
    </span>
  );
}

/** Lo que más pesó en el resultado, como notas de cata. */
export function ListaRazones({ razones, nota, oscuro = false }: { razones: Razon[]; nota?: string; oscuro?: boolean }) {
  return (
    <div>
      <h3 className={`font-display text-[1.65rem] font-medium leading-tight ${oscuro ? "text-white" : "text-marino"}`}>Lo que más pesó</h3>
      <ul className={`mt-3 divide-y border-y ${oscuro ? "divide-white/15 border-white/15" : "divide-borde border-borde"}`}>
        {razones.map((r) => (
          <li key={r.variable} className="flex items-center gap-3.5 py-3.5">
            <span
              aria-hidden
              className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white
                ${r.efecto === "favorece" ? "bg-verde" : r.efecto === "resta" ? "bg-rojo" : "bg-suave"}`}
            >
              {r.efecto === "favorece" ? "+" : r.efecto === "resta" ? "−" : "·"}
            </span>
            <span className="text-[1.02rem]">{r.texto}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-2.5 text-sm ${oscuro ? "text-white/70" : "text-suave"}`}>
        {nota ?? "Explicación aproximada: indica en qué se parece o se aleja el lote de un vino bueno típico."}
      </p>
    </div>
  );
}

export function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-amarillo/50 border-l-4 border-l-amarillo bg-amarillo-claro p-4 text-amarillo-texto">
      <p className="font-semibold">Revisa estos datos</p>
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
    <p role="status" className="py-10 text-center text-suave">
      {texto}
    </p>
  );
}

export function ErrorCaja({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-rojo/40 border-l-4 border-l-rojo bg-rojo-claro p-4 font-medium text-rojo-texto">
      {children}
    </div>
  );
}

/** Una pantalla vacía es una invitación a actuar. */
export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-borde bg-white p-10 text-center">
      <p className="font-display text-2xl font-medium text-marino">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-suave">{children}</div>}
    </div>
  );
}
