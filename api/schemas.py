"""Esquemas de entrada y salida de la API (Pydantic)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .variables import NOMBRES_VARIABLES

NOTA_RAZONES = (
    "Las razones son una explicación aproximada: indican en qué se parece o se "
    "aleja el lote de un vino bueno típico, no son un cálculo exacto del modelo."
)

Decision = Literal["Premium", "Mandar a cata", "Estándar"]


def _num(**kw):
    return Field(allow_inf_nan=False, **kw)


class AnalisisIn(BaseModel):
    """Captura de la enóloga. Los nombres de los análisis coinciden con el modelo."""

    model_config = ConfigDict(str_strip_whitespace=True)

    codigo: str = Field(min_length=1, max_length=60, description="Código del lote")
    tanque: str = Field(default="", max_length=60)
    capturado_por: str = Field(default="", max_length=80)
    id_cliente: str | None = Field(default=None, max_length=64,
                                   description="Evita duplicados al sincronizar sin conexión")
    fecha: datetime | None = Field(default=None, description="Si se capturó sin conexión")

    fixed_acidity: float = _num(ge=0, le=100)
    volatile_acidity: float = _num(ge=0, le=100)
    citric_acid: float = _num(ge=0, le=100)
    residual_sugar: float = _num(ge=0, le=1000)
    chlorides: float = _num(ge=0, le=100)
    free_sulfur_dioxide: float = _num(ge=0, le=2000)
    total_sulfur_dioxide: float = _num(ge=0, le=2000)
    density: float = _num(gt=0.5, lt=2.0)
    pH: float = _num(gt=0, lt=14)
    sulphates: float = _num(ge=0, le=100)
    alcohol: float = _num(ge=0, le=100)

    def valores(self) -> dict[str, float]:
        return {n: getattr(self, n) for n in NOMBRES_VARIABLES}


class Razon(BaseModel):
    variable: str
    nombre: str
    valor: float
    nivel: str
    efecto: str
    texto: str


class ResultadoEvaluacion(BaseModel):
    lote_id: int
    analisis_id: int
    codigo: str
    tanque: str
    probabilidad: float
    semaforo: str
    etiqueta: str
    razones: list[Razon]
    advertencias: list[str]
    version_modelo: str
    nota: str = NOTA_RAZONES


class DecisionIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    lote_id: int
    decision: Decision
    quien: str = Field(default="", max_length=80)
    comentario: str = Field(default="", max_length=1000)


class DecisionOut(BaseModel):
    id: int
    lote_id: int
    decision: str
    quien: str
    fecha: datetime
    comentario: str


class LoteResumen(BaseModel):
    id: int
    codigo: str
    tanque: str
    fecha: datetime
    es_demo: bool
    capturado_por: str
    analisis_id: int | None
    probabilidad: float | None
    semaforo: str | None
    etiqueta: str | None
    decision_actual: str | None


class LoteFicha(LoteResumen):
    valores: dict[str, float]
    razones: list[Razon]
    advertencias: list[str]
    version_modelo: str | None
    decisiones: list[DecisionOut]
    nota: str = NOTA_RAZONES


class ConfiguracionIO(BaseModel):
    umbral_activo: float = Field(gt=0, le=1)
    costo_falso_premium: float = _num(ge=0, le=1e9)
    costo_bueno_perdido: float = _num(ge=0, le=1e9)
    actualizado_por: str = Field(default="", max_length=80)


class ConfiguracionOut(ConfiguracionIO):
    actualizado: datetime


class SimularIn(BaseModel):
    """Valores modificados. Si se da `lote_id`, se parte de su último análisis."""

    lote_id: int | None = None
    valores: dict[str, float] = Field(default_factory=dict)

    @field_validator("valores")
    @classmethod
    def _solo_conocidos(cls, v: dict[str, float]):
        desconocidos = [k for k in v if k not in NOMBRES_VARIABLES]
        if desconocidos:
            raise ValueError(f"Variables desconocidas: {', '.join(desconocidos)}")
        return v


class SimularOut(BaseModel):
    probabilidad: float
    semaforo: str
    etiqueta: str
    probabilidad_original: float | None
    cambio: float | None
    razones: list[Razon]
    advertencias: list[str]
    valores: dict[str, float]


class ResumenOut(BaseModel):
    desde: date
    lotes_semana: int
    verdes: int
    amarillos: int
    rojos: int
    sin_decision: int
    umbral_activo: float
