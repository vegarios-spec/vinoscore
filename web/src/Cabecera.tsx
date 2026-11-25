import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type Rol = "enologa" | "sergio";

/**
 * Barra superior igual para las dos personas. El cambio de vista vive en el menú
 * de perfil (en el prototipo no hay contraseña); `extra` es para acciones propias
 * de cada vista, como la regla activa de Sergio.
 */
export function Cabecera({
  rol, onRol, nombre, onNombre, extra,
}: {
  rol: Rol;
  onRol: (r: Rol) => void;
  nombre: string;
  onNombre: (n: string) => void;
  extra?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const quien = rol === "sergio" ? "Sergio" : nombre || "Enóloga";

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-noche text-white">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <img src="/icono.svg" alt="" className="size-8 rounded-md" />
          <span className="font-display text-[1.55rem] font-medium leading-none tracking-[0.01em]">VinoScore</span>
        </div>

        <div className="flex items-center gap-2">
          {extra}
          <div className="relative" ref={caja}>
            <button
              onClick={() => setAbierto((a) => !a)}
              aria-expanded={abierto}
              aria-haspopup="true"
              className="flex min-h-11 items-center gap-2 rounded-lg py-1 pl-1.5 pr-3 font-medium hover:bg-white/10"
            >
              <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 font-display text-lg font-medium text-white ring-1 ring-laton">
                {quien.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{quien}</span>
              <span aria-hidden className="text-xs">▾</span>
            </button>
            {abierto && (
              <div role="group" aria-label="Cambiar de vista" className="absolute right-0 mt-2 w-72 rounded-xl bg-white p-3 text-tinta shadow-2xl">
                <p className="px-2 pb-2 text-sm font-semibold text-suave">Ver VinoScore como</p>
                {(["enologa", "sergio"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onRol(r);
                      setAbierto(false);
                    }}
                    aria-pressed={rol === r}
                    className={`flex w-full min-h-14 items-center justify-between rounded-xl px-3 text-left ${rol === r ? "bg-hielo" : "hover:bg-papel"}`}
                  >
                    <span>
                      <span className="block font-semibold">{r === "enologa" ? "La enóloga" : "Sergio"}</span>
                      <span className="block text-sm text-suave">
                        {r === "enologa" ? "Captura de lotes, en el celular" : "Decisiones, en la computadora"}
                      </span>
                    </span>
                    {rol === r && <span aria-hidden className="font-semibold text-turquesa">✓</span>}
                  </button>
                ))}
                {rol === "enologa" && (
                  <label className="mt-2 block px-2 text-sm font-semibold">
                    Tu nombre en las capturas
                    <input value={nombre} onChange={(e) => onNombre(e.target.value)} className="campo mt-1 !min-h-11 !text-base" autoComplete="off" />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
