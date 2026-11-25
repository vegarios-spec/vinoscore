import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Panel lateral accesible: Esc lo cierra, el foco queda dentro mientras está
 * abierto y vuelve a donde estaba al cerrarlo.
 */
export function Panel({
  titulo, subtitulo, onCerrar, children, pie, ancho = "sm:max-w-[780px]",
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => ref.current?.focus(), 30);

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const lista = Array.from(ref.current.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((x) => x.offsetParent !== null);
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === ref.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-noche/65" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-titulo"
        tabIndex={-1}
        className={`panel-entra absolute right-0 top-0 flex h-full w-full ${ancho} flex-col bg-papel shadow-2xl outline-none`}
      >
        <header className="flex items-start justify-between gap-4 bg-white px-5 py-4 shadow-[0_1px_0_var(--color-borde)]">
          <div className="min-w-0">
            <h2 id="panel-titulo" className="font-display text-[1.9rem] font-medium leading-tight text-marino">
              {titulo}
            </h2>
            {subtitulo && <div className="mt-1 text-sm text-suave">{subtitulo}</div>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl text-marino hover:bg-hielo"
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        {pie && <footer className="border-t border-borde bg-white px-5 py-3">{pie}</footer>}
      </div>
    </div>
  );
}
