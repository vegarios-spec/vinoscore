import { useEffect, useState } from "react";
import { api } from "./api";
import type { Variable } from "./tipos";
import { VistaEnologa } from "./vistas/Enologa";
import { VistaSergio } from "./vistas/Sergio";

type Rol = "enologa" | "sergio";

const LS_ROL = "vinoscore.rol";
const LS_NOMBRE = "vinoscore.nombre";
const LS_VARIABLES = "vinoscore.variables";

function leerRol(): Rol {
  // Se puede abrir directo con ?rol=sergio (útil para compartir el enlace).
  const url = new URLSearchParams(location.search).get("rol");
  if (url === "sergio" || url === "enologa") return url;
  return localStorage.getItem(LS_ROL) === "sergio" ? "sergio" : "enologa";
}

export default function App() {
  const [rol, setRol] = useState<Rol>(leerRol);
  const [nombre, setNombre] = useState(() => localStorage.getItem(LS_NOMBRE) ?? "Enóloga");
  const [variables, setVariables] = useState<Variable[] | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_VARIABLES) ?? "null");
    } catch {
      return null;
    }
  });

  // La lista de análisis se guarda en el navegador para poder capturar sin conexión.
  useEffect(() => {
    api
      .variables()
      .then((v) => {
        setVariables(v);
        localStorage.setItem(LS_VARIABLES, JSON.stringify(v));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => localStorage.setItem(LS_ROL, rol), [rol]);
  useEffect(() => localStorage.setItem(LS_NOMBRE, nombre), [nombre]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-marino text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/icono.svg" alt="" className="size-9 rounded-lg" />
            <div className="leading-tight">
              <h1 className="text-xl font-extrabold tracking-tight">VinoScore</h1>
              <p className="hidden text-xs text-white/80 sm:block">¿Qué tan prometedor es tu caldo?</p>
            </div>
          </div>
          <div role="group" aria-label="Elige quién eres" className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
            {(["enologa", "sergio"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRol(r)}
                aria-pressed={rol === r}
                className={`min-h-11 rounded-lg px-4 text-base font-bold transition-colors ${
                  rol === r ? "bg-white text-marino" : "text-white hover:bg-white/15"
                }`}
              >
                {r === "enologa" ? "Enóloga" : "Sergio"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main>
        {rol === "enologa" ? (
          <VistaEnologa variables={variables} nombre={nombre} onNombre={setNombre} />
        ) : (
          <VistaSergio variables={variables} />
        )}
      </main>
    </div>
  );
}
