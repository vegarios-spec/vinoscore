export type Semaforo = "verde" | "amarillo" | "rojo";
export type Decision = "Premium" | "Mandar a cata" | "Estándar";

export interface Variable {
  clave: string;
  nombre: string;
  unidad: string;
  decimales: number;
  ayuda: string;
  rango_normal: [number, number];
  rango_dato: [number, number];
}

export interface Razon {
  variable: string;
  nombre: string;
  valor: number;
  nivel: "alto" | "bajo";
  efecto: "favorece" | "resta" | "neutro";
  texto: string;
}

export interface Resultado {
  lote_id: number;
  analisis_id: number;
  codigo: string;
  tanque: string;
  probabilidad: number;
  semaforo: Semaforo;
  etiqueta: string;
  razones: Razon[];
  advertencias: string[];
  version_modelo: string;
  nota: string;
}

export interface LoteResumen {
  id: number;
  codigo: string;
  tanque: string;
  fecha: string;
  es_demo: boolean;
  capturado_por: string;
  analisis_id: number | null;
  probabilidad: number | null;
  semaforo: Semaforo | null;
  etiqueta: string | null;
  decision_actual: Decision | null;
}

export interface DecisionRegistro {
  id: number;
  lote_id: number;
  decision: Decision;
  quien: string;
  fecha: string;
  comentario: string;
}

export interface LoteFicha extends LoteResumen {
  valores: Record<string, number>;
  razones: Razon[];
  advertencias: string[];
  version_modelo: string | null;
  decisiones: DecisionRegistro[];
  nota: string;
}

export interface Configuracion {
  umbral_activo: number;
  costo_falso_premium: number;
  costo_bueno_perdido: number;
  actualizado: string;
  actualizado_por: string;
}

export interface Resumen {
  desde: string;
  lotes_semana: number;
  verdes: number;
  amarillos: number;
  rojos: number;
  sin_decision: number;
  umbral_activo: number;
}

export interface FilaPerilla {
  umbral: number;
  VP: number;
  FP: number;
  FN: number;
  VN: number;
  costo_por_100_lotes: number;
  falsos_premium_por_100: number;
  buenos_perdidos_por_100: number;
  marcados_premium_por_100: number;
  precision: number | null;
  recall: number | null;
  de_cada_100_premium: number | null;
}

export interface Perilla {
  costo_falso_premium: number;
  costo_bueno_perdido: number;
  umbral_recomendado: number;
  recomendado: FilaPerilla;
  filas: FilaPerilla[];
  frase: string;
  umbral_activo: number;
  nota: string;
}

export interface Simulacion {
  probabilidad: number;
  semaforo: Semaforo;
  etiqueta: string;
  probabilidad_original: number | null;
  cambio: number | null;
  razones: Razon[];
  advertencias: string[];
  valores: Record<string, number>;
}

/** Cuerpo de POST /analisis */
export type CapturaPayload = {
  codigo: string;
  tanque: string;
  capturado_por: string;
  id_cliente: string;
  fecha: string;
} & Record<string, number | string>;
