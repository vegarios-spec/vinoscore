import type { Semaforo } from "./tipos";

export const pct = (p: number) => `${Math.round(p * 100)} %`;

export const peso = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function num(v: number, decimales: number): string {
  return v.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Todo lo visual del semáforo en un solo lugar. Siempre va con texto, nunca solo color. */
export const SEMAFORO: Record<
  Semaforo,
  { etiqueta: string; icono: string; relleno: string; fondo: string; texto: string; borde: string; significado: string }
> = {
  verde: {
    etiqueta: "Prometedor",
    icono: "✓",
    relleno: "bg-verde",
    fondo: "bg-verde-claro",
    texto: "text-verde-texto",
    borde: "border-verde",
    significado: "Buen candidato para el sello Premium. Avísale a Sergio para que lo revise.",
  },
  amarillo: {
    etiqueta: "Revisar en cata",
    icono: "!",
    relleno: "bg-amarillo",
    fondo: "bg-amarillo-claro",
    texto: "text-amarillo-texto",
    borde: "border-amarillo",
    significado: "Todavía no está claro. Conviene probarlo en cata antes de decidir.",
  },
  rojo: {
    etiqueta: "Estándar",
    icono: "–",
    relleno: "bg-rojo",
    fondo: "bg-rojo-claro",
    texto: "text-rojo-texto",
    borde: "border-rojo",
    significado: "Por ahora se ve como un vino estándar. No parece destacar en calidad.",
  },
};

export function fraseProbabilidad(p: number): string {
  const de100 = Math.round(p * 100);
  return `Probabilidad estimada de ser un vino de calidad alta: ${de100} de cada 100.`;
}

/** Acepta "0,45" y "0.45". Devuelve null si no es un número válido. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
