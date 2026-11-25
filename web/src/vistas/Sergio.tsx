import { useState } from "react";
import type { Variable } from "../tipos";
import { ErrorCaja } from "../ui";
import { Ficha } from "./Ficha";
import { VistaPerilla } from "./Perilla";
import { VistaSimulador } from "./Simulador";
import { Tablero } from "./Tablero";

type Seccion = "tablero" | "perilla" | "simulador";

const SECCIONES: { id: Seccion; texto: string }[] = [
  { id: "tablero", texto: "Tablero" },
  { id: "perilla", texto: "Perilla del dinero" },
  { id: "simulador", texto: "¿Qué pasa si…?" },
];

export function VistaSergio({ variables }: { variables: Variable[] | null }) {
  const [seccion, setSeccion] = useState<Seccion>("tablero");
  const [loteAbierto, setLoteAbierto] = useState<number | null>(null);
  const [loteSim, setLoteSim] = useState<number | null>(null);
  // Se incrementa cuando cambia algo (decisión, regla) para que el tablero se refresque.
  const [version, setVersion] = useState(0);
  const refrescar = () => setVersion((v) => v + 1);

  const ir = (s: Seccion) => {
    setSeccion(s);
    setLoteAbierto(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5">
      <nav aria-label="Secciones" className="mb-5 flex flex-wrap gap-2 border-b border-borde pb-3">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => ir(s.id)}
            aria-current={seccion === s.id && loteAbierto === null ? "page" : undefined}
            className={`min-h-11 rounded-xl px-4 text-base font-bold transition-colors ${
              seccion === s.id ? "bg-marino text-white" : "text-marino hover:bg-white"
            }`}
          >
            {s.texto}
          </button>
        ))}
      </nav>

      {seccion === "tablero" &&
        (loteAbierto !== null ? (
          variables ? (
            <Ficha
              loteId={loteAbierto}
              variables={variables}
              onVolver={() => setLoteAbierto(null)}
              onCambio={refrescar}
              onSimular={(id) => {
                setLoteSim(id);
                setLoteAbierto(null);
                setSeccion("simulador");
              }}
            />
          ) : (
            <ErrorCaja>No se pudo cargar la lista de análisis.</ErrorCaja>
          )
        ) : (
          <Tablero version={version} onAbrir={setLoteAbierto} umbral={null} />
        ))}

      {seccion === "perilla" && <VistaPerilla onConfigCambia={refrescar} />}

      {seccion === "simulador" &&
        (variables ? <VistaSimulador variables={variables} loteInicial={loteSim} /> : <ErrorCaja>No se pudo cargar la lista de análisis.</ErrorCaja>)}
    </div>
  );
}
