"""Tablas de la base de datos."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .variables import NOMBRES_VARIABLES


def ahora() -> datetime:
    return datetime.now().replace(microsecond=0)


class Lote(Base):
    __tablename__ = "lotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    tanque: Mapped[str] = mapped_column(String(60), default="", index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora, index=True)
    es_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    analisis: Mapped[list["Analisis"]] = relationship(
        back_populates="lote", order_by="Analisis.id", cascade="all, delete-orphan"
    )
    decisiones: Mapped[list["Decision"]] = relationship(
        back_populates="lote", order_by="Decision.id", cascade="all, delete-orphan"
    )


class Analisis(Base):
    __tablename__ = "analisis"

    id: Mapped[int] = mapped_column(primary_key=True)
    lote_id: Mapped[int] = mapped_column(ForeignKey("lotes.id"), index=True)
    # Identificador generado por la app para no duplicar capturas al sincronizar.
    id_cliente: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    capturado_por: Mapped[str] = mapped_column(String(80), default="")
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    fixed_acidity: Mapped[float] = mapped_column(Float)
    volatile_acidity: Mapped[float] = mapped_column(Float)
    citric_acid: Mapped[float] = mapped_column(Float)
    residual_sugar: Mapped[float] = mapped_column(Float)
    chlorides: Mapped[float] = mapped_column(Float)
    free_sulfur_dioxide: Mapped[float] = mapped_column(Float)
    total_sulfur_dioxide: Mapped[float] = mapped_column(Float)
    density: Mapped[float] = mapped_column(Float)
    pH: Mapped[float] = mapped_column(Float)
    sulphates: Mapped[float] = mapped_column(Float)
    alcohol: Mapped[float] = mapped_column(Float)

    lote: Mapped[Lote] = relationship(back_populates="analisis")
    prediccion: Mapped["Prediccion"] = relationship(
        back_populates="analisis", uselist=False, cascade="all, delete-orphan"
    )

    def valores(self) -> dict[str, float]:
        return {n: getattr(self, n) for n in NOMBRES_VARIABLES}


class Prediccion(Base):
    __tablename__ = "predicciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    analisis_id: Mapped[int] = mapped_column(ForeignKey("analisis.id"), unique=True)
    probabilidad: Mapped[float] = mapped_column(Float, index=True)
    semaforo: Mapped[str] = mapped_column(String(10))  # semáforo al momento de evaluar
    umbral_usado: Mapped[float] = mapped_column(Float)
    razones: Mapped[list] = mapped_column(JSON)
    advertencias: Mapped[list] = mapped_column(JSON, default=list)
    version_modelo: Mapped[str] = mapped_column(String(40))
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    analisis: Mapped[Analisis] = relationship(back_populates="prediccion")


class Decision(Base):
    __tablename__ = "decisiones"

    id: Mapped[int] = mapped_column(primary_key=True)
    lote_id: Mapped[int] = mapped_column(ForeignKey("lotes.id"), index=True)
    decision: Mapped[str] = mapped_column(String(30))  # Premium / Mandar a cata / Estándar
    quien: Mapped[str] = mapped_column(String(80), default="")
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    comentario: Mapped[str] = mapped_column(Text, default="")

    lote: Mapped[Lote] = relationship(back_populates="decisiones")


class Configuracion(Base):
    """Una sola fila (id = 1) con la configuración activa."""

    __tablename__ = "configuracion"

    id: Mapped[int] = mapped_column(primary_key=True)
    umbral_activo: Mapped[float] = mapped_column(Float)
    costo_falso_premium: Mapped[float] = mapped_column(Float)
    costo_bueno_perdido: Mapped[float] = mapped_column(Float)
    actualizado: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    actualizado_por: Mapped[str] = mapped_column(String(80), default="")
