import type {
  CapturaPayload, Configuracion, Decision, LoteFicha, LoteResumen, Perilla, Resultado,
  Resumen, Simulacion, Variable,
} from "./tipos";

const BASE: string = import.meta.env.VITE_API_URL ?? "";

/** No hubo respuesta del servidor (sin conexión o servidor apagado). */
export class ErrorRed extends Error {
  constructor() {
    super("No hay conexión con el servidor.");
  }
}

/** El servidor respondió, pero rechazó la petición. */
export class ErrorApi extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

function mensajeDe(detalle: unknown): string {
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    return detalle
      .map((d) => (d && typeof d === "object" && "campo" in d ? `${d.campo}: ${d.mensaje}` : String(d)))
      .join(". ");
  }
  return "El servidor no pudo procesar la petición.";
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(BASE + ruta, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ErrorRed();
  }
  if (!r.ok) {
    let detalle: unknown = null;
    try {
      detalle = (await r.json()).detail;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ErrorApi(r.status, mensajeDe(detalle));
  }
  return (await r.json()) as T;
}

const enJson = (cuerpo: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(cuerpo) });

function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  variables: () => pedir<Variable[]>("/variables"),
  crearAnalisis: (p: CapturaPayload) => pedir<Resultado>("/analisis", enJson(p)),
  lotes: (f: { desde?: string; hasta?: string; tanque?: string; capturado_por?: string; semaforo?: string; orden?: string } = {}) =>
    pedir<LoteResumen[]>(`/lotes${query(f)}`),
  lote: (id: number) => pedir<LoteFicha>(`/lotes/${id}`),
  resumen: () => pedir<Resumen>("/resumen"),
  decidir: (lote_id: number, decision: Decision, quien: string, comentario: string) =>
    pedir("/decisiones", enJson({ lote_id, decision, quien, comentario })),
  configuracion: () => pedir<Configuracion>("/configuracion"),
  guardarConfiguracion: (c: Pick<Configuracion, "umbral_activo" | "costo_falso_premium" | "costo_bueno_perdido"> & { actualizado_por?: string }) =>
    pedir<Configuracion>("/configuracion", { method: "PUT", body: JSON.stringify(c) }),
  perilla: (costo_falso_premium: number, costo_bueno_perdido: number) =>
    pedir<Perilla>(`/perilla${query({ costo_falso_premium, costo_bueno_perdido })}`),
  simular: (lote_id: number, valores: Record<string, number>) =>
    pedir<Simulacion>("/simular", enJson({ lote_id, valores })),
  urlCsv: `${BASE}/exportar.csv`,
};
