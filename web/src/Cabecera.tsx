import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { aplicarTema, leerTema } from "./tema";
import type { Tema } from "./tema";

export type Rol = "enologa" | "sergio";

/** Media luna (oscuro) o círculo con rayos (claro): indica a qué tema se cambia. */
function IconoTema({ a }: { a: Tema }) {
  return a === "claro" ? (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((g) => (
        <line key={g} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${g} 12 12)`} />
      ))}
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
    </svg>
  );
}

/**
 * Barra superior igual para las dos personas: nombre, cambio de tema y menú de perfil
 * (el cambio de vista vive ahí; en el prototipo no hay contraseña).
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
  const [tema, setTema] = useState<Tema>(leerTema);
  const caja = useRef<HTMLDivElement>(null);
  const quien = rol === "sergio" ? "Sergio" : nombre || "Enóloga";
  const otro: Tema = tema === "oscuro" ? "claro" : "oscuro";

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
    <header className="sticky top-0 z-30 border-b border-linea bg-fondo">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-6">
        <span className="text-base font-semibold tracking-tight">VinoScore</span>

        <div className="flex items-center gap-1">
          {extra}
          <button
            onClick={() => {
              aplicarTema(otro);
              setTema(otro);
            }}
            aria-label={`Cambiar a tema ${otro}`}
            title={`Cambiar a tema ${otro}`}
            className="inline-flex size-10 items-center justify-center text-suave hover:bg-realce hover:text-texto"
          >
            <IconoTema a={otro} />
          </button>

          <div className="relative" ref={caja}>
            <button
              onClick={() => setAbierto((a) => !a)}
              aria-expanded={abierto}
              aria-haspopup="true"
              className="flex h-10 items-center gap-2 px-3 text-sm font-medium hover:bg-realce"
            >
              <span className="max-w-40 truncate">{quien}</span>
              <span aria-hidden className="text-[0.625rem] text-suave">▼</span>
            </button>
            {abierto && (
              <div role="group" aria-label="Cambiar de vista" className="absolute right-0 mt-1 w-72 border border-linea-fuerte bg-superficie p-2">
                <p className="px-2 pb-2 pt-1 text-xs text-suave">Ver VinoScore como</p>
                {(["enologa", "sergio"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onRol(r);
                      setAbierto(false);
                    }}
                    aria-pressed={rol === r}
                    className={`flex min-h-12 w-full items-center justify-between px-2 text-left ${rol === r ? "bg-realce" : "hover:bg-realce"}`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{r === "enologa" ? "Enóloga" : "Dirección (Sergio)"}</span>
                      <span className="block text-xs text-suave">
                        {r === "enologa" ? "Captura de lotes, en el celular" : "Decisiones, en la computadora"}
                      </span>
                    </span>
                    {rol === r && <span aria-hidden className="text-sm">✓</span>}
                  </button>
                ))}
                {rol === "enologa" && (
                  <label className="mt-2 block px-2 pb-1 text-xs text-suave">
                    Nombre en las capturas
                    <input value={nombre} onChange={(e) => onNombre(e.target.value)} className="campo mt-1 !min-h-10 text-texto" autoComplete="off" />
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
