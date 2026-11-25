import { guardarLocal, leerLocal } from "./almacen";

export type Tema = "oscuro" | "claro";

const CLAVE = "vinoscore.tema";

/** Oscuro salvo que la persona haya elegido claro antes. */
export function leerTema(): Tema {
  return leerLocal(CLAVE) === "claro" ? "claro" : "oscuro";
}

export function aplicarTema(t: Tema): void {
  document.documentElement.dataset.tema = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "claro" ? "#F7F7F5" : "#141516");
  guardarLocal(CLAVE, t);
}
