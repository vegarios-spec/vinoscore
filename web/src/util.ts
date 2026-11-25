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

/** "hoy 10:30", "ayer", "hace 3 días" o la fecha corta si ya pasó más de una semana. */
export function fechaRelativa(iso: string): string {
  const f = new Date(iso);
  const hoy = new Date();
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(hoy) - inicio(f)) / 86400000);
  const hora = f.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  if (dias <= 0) return `hoy ${hora}`;
  if (dias === 1) return `ayer ${hora}`;
  if (dias < 7) return `hace ${dias} días`;
  return fechaCorta(iso);
}

export function num(v: number, decimales: number): string {
  return v.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** yyyy-mm-dd de hace `n` días (hora local), para los filtros de fecha. */
export function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const dos = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Todo lo visual del semáforo en un solo lugar. Siempre va con texto, nunca solo color.
 * `pantalla` es el fondo grande del resultado; `ink` es la tinta del sello.
 */
export const SEMAFORO: Record<
  Semaforo,
  {
    etiqueta: string; plural: string; ink: string; relleno: string; fondo: string; texto: string;
    pantalla: string; significado: string; verbo: string;
  }
> = {
  verde: {
    etiqueta: "Prometedor",
    plural: "Prometedores",
    ink: "#2a561b",
    relleno: "bg-verde",
    fondo: "bg-verde-claro",
    texto: "text-verde-texto",
    pantalla: "bg-verde text-white",
    significado: "Buen candidato para el sello Premium. Avisar a dirección.",
    verbo: "Listo para sello Premium",
  },
  amarillo: {
    etiqueta: "Revisar en cata",
    plural: "Para cata",
    ink: "#6a4800",
    relleno: "bg-amarillo",
    fondo: "bg-amarillo-claro",
    texto: "text-amarillo-texto",
    pantalla: "bg-amarillo text-noche",
    significado: "Todavía no está claro. Conviene catarlo antes de decidir.",
    verbo: "Hay que catarlo",
  },
  rojo: {
    etiqueta: "Estándar",
    plural: "Estándar",
    ink: "#8a2216",
    relleno: "bg-rojo",
    fondo: "bg-rojo-claro",
    texto: "text-rojo-texto",
    pantalla: "bg-rojo text-white",
    significado: "Por ahora se ve como un vino estándar. No destaca en calidad.",
    verbo: "Vino estándar",
  },
};

export const ORDEN_SEMAFORO: Semaforo[] = ["verde", "amarillo", "rojo"];

export function fraseProbabilidad(p: number): string {
  return `De cada 100 lotes con análisis parecidos, unos ${Math.round(p * 100)} resultan de calidad alta.`;
}

/**
 * Cantidades en pesos: "$1,500", "1500" o "1,500.50". La coma es separador de miles
 * (uso de México), así que "1,500" vale 1500 y no 1.5. Devuelve null si no es un número.
 */
export function leerPesos(texto: string): number | null {
  const t = texto.replace(/[$\s,]/g, "");
  if (t === "" || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Análisis de laboratorio: acepta "0,45" y "0.45". Devuelve null si no es un número válido. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
