"""Carga del modelo y lógica de negocio: probabilidad, semáforo, razones, avisos.

IMPORTANTE: las "razones" son una explicación APROXIMADA. No son una
descomposición exacta de la predicción del Random Forest: son una guía simple
basada en qué tan lejos está el lote de lo típico de un vino bueno.
"""
from __future__ import annotations

import json
from functools import lru_cache

import joblib
import pandas as pd

from . import config
from .variables import ORDEN_MODELO, POR_CLAVE

SEMAFOROS = ("verde", "amarillo", "rojo")
ETIQUETAS = {"verde": "Prometedor", "amarillo": "Revisar en cata", "rojo": "Estándar"}


class ModeloNoDisponible(RuntimeError):
    pass


@lru_cache(maxsize=1)
def cargar_modelo() -> dict:
    if not config.RUTA_MODELO.exists():
        raise ModeloNoDisponible(
            f"No se encontró {config.RUTA_MODELO}. Corre: python modelo/entrenar.py"
        )
    return joblib.load(config.RUTA_MODELO)


@lru_cache(maxsize=1)
def cargar_metricas() -> dict:
    if not config.RUTA_METRICAS.exists():
        raise ModeloNoDisponible(
            f"No se encontró {config.RUTA_METRICAS}. Corre: python modelo/entrenar.py"
        )
    return json.loads(config.RUTA_METRICAS.read_text(encoding="utf-8"))


def version_modelo() -> str:
    return cargar_modelo().get("version", "desconocida")


# ----------------------------------------------------------------- predicción
def predecir(valores: dict[str, float]) -> float:
    """Probabilidad (0 a 1) de que el vino sea de calidad 7 o más."""
    faltan = [c for c in ORDEN_MODELO if c not in valores]
    if faltan:
        raise ValueError(f"Faltan valores: {', '.join(faltan)}")
    X = pd.DataFrame([{c: float(valores[c]) for c in ORDEN_MODELO}])[ORDEN_MODELO]
    return float(cargar_modelo()["modelo"].predict_proba(X)[0, 1])


def semaforo(probabilidad: float, umbral: float) -> str:
    """Verde: p >= umbral. Amarillo: entre 0.3 y el umbral. Rojo: p < 0.3."""
    if probabilidad >= umbral:
        return "verde"
    if probabilidad >= config.LIMITE_AMARILLO:
        return "amarillo"
    return "rojo"


def etiqueta(sem: str) -> str:
    return ETIQUETAS[sem]


# ------------------------------------------------------------------- avisos
def _fmt(v: float, decimales: int) -> str:
    return f"{v:.{decimales}f}"


def advertencias(valores: dict[str, float]) -> list[str]:
    """Avisos para valores fuera del rango normal (percentiles 1 y 99).

    Nunca bloquean el guardado: solo piden revisar la captura.
    """
    rangos = cargar_metricas()["rangos_normales"]
    avisos: list[str] = []
    for clave in ORDEN_MODELO:
        v = valores.get(clave)
        if v is None:
            continue
        r = rangos[clave]
        info = POR_CLAVE[clave]
        if v < r["p1"] or v > r["p99"]:
            d = info["decimales"]
            # Si al redondear el valor queda igual que el límite, se agregan decimales.
            if _fmt(v, d) in (_fmt(r["p1"], d), _fmt(r["p99"], d)):
                d += 2
            unidad = f" {info['unidad']}" if info["unidad"] else ""
            avisos.append(
                f"{info['nombre']} ({_fmt(v, d)}{unidad}) está fuera de lo normal "
                f"({_fmt(r['p1'], d)} a {_fmt(r['p99'], d)}). Revisa que esté bien capturado."
            )
    return avisos


# ------------------------------------------------------------------ razones
def _adjetivo(info: dict, alto: bool) -> str:
    base = "alt" if alto else "baj"
    terminacion = ("os" if info["plural"] else "o") if info["genero"] == "m" else (
        "as" if info["plural"] else "a")
    return base + terminacion


def razones(valores: dict[str, float], n: int = 3) -> list[dict]:
    """Las `n` variables con más peso en las que el lote más se aleja de la
    mediana de los vinos buenos, explicadas en lenguaje simple.

    puntaje = importancia de la variable x distancia a la mediana de los buenos
              (en desviaciones estándar).
    "alto/bajo" se mide contra el punto medio entre la mediana de los vinos
    buenos y la de los no buenos; "favorece/resta" según de qué lado cae.
    """
    m = cargar_metricas()
    imp = m["importancia_variables"]
    med_b = m["medianas_buenos"]
    med_n = m["medianas_no_buenos"]
    sd = m["desviacion_estandar"]

    candidatas = []
    for clave in ORDEN_MODELO:
        v = valores[clave]
        distancia = abs(v - med_b[clave]) / sd[clave]
        candidatas.append((imp[clave] * distancia, clave))
    candidatas.sort(reverse=True)

    resultado = []
    for puntaje, clave in candidatas[:n]:
        info = POR_CLAVE[clave]
        v = valores[clave]
        punto_medio = (med_b[clave] + med_n[clave]) / 2
        lado_bueno = (v - punto_medio) * (med_b[clave] - med_n[clave])
        alto = v > punto_medio
        if lado_bueno > 0:
            efecto, verbo = "favorece", "favorece" if not info["plural"] else "favorecen"
            cierre = f"{verbo} la calidad"
        elif lado_bueno < 0:
            efecto = "resta"
            verbo = "resta a" if not info["plural"] else "restan a"
            cierre = f"{verbo} la calidad"
        else:
            efecto, cierre = "neutro", "sin efecto claro"
        d = info["decimales"]
        unidad = f" {info['unidad']}" if info["unidad"] else ""
        valor_txt = f"{_fmt(v, d)}{unidad}".replace(" % vol", " %")
        texto = f"{info['nombre']} {_adjetivo(info, alto)} ({valor_txt}): {cierre}"
        resultado.append({
            "variable": clave,
            "nombre": info["nombre"],
            "valor": v,
            "nivel": "alto" if alto else "bajo",
            "efecto": efecto,
            "texto": texto,
        })
    return resultado


# ---------------------------------------------------------------- resultado
def evaluar(valores: dict[str, float], umbral: float) -> dict:
    p = predecir(valores)
    sem = semaforo(p, umbral)
    return {
        "probabilidad": p,
        "semaforo": sem,
        "etiqueta": etiqueta(sem),
        "razones": razones(valores),
        "advertencias": advertencias(valores),
        "version_modelo": version_modelo(),
    }
