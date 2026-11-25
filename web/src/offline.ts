/**
 * Modo sin conexión básico.
 *
 * Si no hay red al guardar una captura, se guarda en IndexedDB (en el navegador
 * del teléfono) y se envía sola cuando vuelve la conexión. Cada captura lleva un
 * `id_cliente`, así que si el envío se repite el servidor no la duplica.
 */
import { api, ErrorApi, ErrorRed } from "./api";
import type { CapturaPayload } from "./tipos";

const BD = "vinoscore";
const ALMACEN = "pendientes";
export const EVENTO = "vinoscore:pendientes";

export interface Pendiente {
  id_cliente: string;
  payload: CapturaPayload;
  creada: string;
  error?: string; // el servidor la rechazó: hay que corregirla
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN, { keyPath: "id_cliente" });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(ALMACEN, modo);
    const r = f(t.objectStore(ALMACEN));
    t.oncomplete = () => {
      db.close();
      ok(r.result);
    };
    t.onerror = () => mal(t.error);
  });
}

const avisar = () => window.dispatchEvent(new Event(EVENTO));

/** crypto.randomUUID solo existe en HTTPS/localhost; en http por la red local hace falta un plan B. */
export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function guardarPendiente(payload: CapturaPayload): Promise<Pendiente> {
  const p: Pendiente = { id_cliente: payload.id_cliente, payload, creada: new Date().toISOString() };
  await tx("readwrite", (s) => s.put(p));
  avisar();
  return p;
}

export async function listarPendientes(): Promise<Pendiente[]> {
  const todas = await tx<Pendiente[]>("readonly", (s) => s.getAll());
  return todas.sort((a, b) => a.creada.localeCompare(b.creada));
}

async function quitar(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

let sincronizando = false;

/** Envía las capturas pendientes. Se detiene en cuanto detecta que no hay red. */
export async function sincronizar(): Promise<{ enviadas: number; rechazadas: number; sinRed: boolean }> {
  if (sincronizando) return { enviadas: 0, rechazadas: 0, sinRed: false };
  sincronizando = true;
  let enviadas = 0;
  let rechazadas = 0;
  let sinRed = false;
  try {
    for (const p of await listarPendientes()) {
      try {
        await api.crearAnalisis(p.payload);
        await quitar(p.id_cliente);
        enviadas++;
      } catch (e) {
        if (e instanceof ErrorRed) {
          sinRed = true;
          break;
        }
        if (e instanceof ErrorApi && e.status >= 400 && e.status < 500) {
          await tx("readwrite", (s) => s.put({ ...p, error: e.message }));
          rechazadas++;
        } else {
          break; // error del servidor: se reintenta después
        }
      }
    }
  } finally {
    sincronizando = false;
    avisar();
  }
  return { enviadas, rechazadas, sinRed };
}

export async function descartarPendiente(id: string) {
  await quitar(id);
  avisar();
}
