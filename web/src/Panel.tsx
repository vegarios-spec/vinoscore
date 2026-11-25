import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Panel encima de la página para pantallas angostas: Esc lo cierra, el foco queda
 * dentro mientras está abierto y vuelve a donde estaba al cerrarlo.
 */
export function Panel({
  etiqueta, onCerrar, children,
}: {
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode;
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
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-linea-fuerte bg-fondo outline-none"
      >
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-linea px-2">
          <button onClick={onCerrar} className="h-10 px-3 text-sm text-suave hover:bg-realce hover:text-texto">
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
