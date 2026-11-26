/**
 * localStorage puede no existir o lanzar error (modo privado, sitio bloqueado).
 * Estas dos funciones nunca lanzan: si falla, la app sigue con sus valores por defecto.
 */
export function leerLocal(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarLocal(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: el valor dura solo esta sesión.
  }
}
