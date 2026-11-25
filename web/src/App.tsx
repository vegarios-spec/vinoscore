import { useEffect, useState } from "react";
import { api } from "./api";
import type { Rol } from "./Cabecera";
import type { Variable } from "./tipos";
import { VistaEnologa } from "./vistas/Enologa";
import { VistaSergio } from "./vistas/Sergio";

const LS_ROL = "vinoscore.rol";
const LS_NOMBRE = "vinoscore.nombre";
const LS_VARIABLES = "vinoscore.variables";

function leerRol(): Rol {
  // Se puede abrir directo con ?rol=sergio (útil para compartir el enlace).
  const url = new URLSearchParams(location.search).get("rol");
  if (url === "sergio" || url === "enologa") return url;
  const guardado = localStorage.getItem(LS_ROL);
  if (guardado === "sergio" || guardado === "enologa") return guardado;
  // La primera vez: en pantalla ancha se abre como Sergio; en el celular, como la enóloga.
  return window.matchMedia("(min-width: 1024px)").matches ? "sergio" : "enologa";
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

  return rol === "enologa" ? (
    <VistaEnologa variables={variables} nombre={nombre} onNombre={setNombre} rol={rol} onRol={setRol} />
  ) : (
    <VistaSergio variables={variables} rol={rol} onRol={setRol} nombre={nombre} onNombre={setNombre} />
  );
}
