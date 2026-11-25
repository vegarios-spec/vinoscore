"""API de VinoScore (FastAPI).

Correr desde la raíz del proyecto:
    uvicorn api.main:app --reload
Documentación interactiva: http://localhost:8000/docs
"""
from __future__ import annotations

import csv
import io
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import config, servicio_modelo as sm
from .db import crear_tablas, get_db
from .models import Analisis, Configuracion, Decision, Lote, Prediccion, ahora
from .perilla import calcular_perilla
from .schemas import (
    AnalisisIn,
    ConfiguracionIO,
    ConfiguracionOut,
    DecisionIn,
    DecisionOut,
    LoteFicha,
    LoteResumen,
    ResultadoEvaluacion,
    ResumenOut,
    SimularIn,
    SimularOut,
)
from .variables import NOMBRES_VARIABLES, VARIABLES


@asynccontextmanager
async def lifespan(app: FastAPI):
    crear_tablas()
    sm.cargar_modelo()  # falla pronto y con mensaje claro si falta el modelo
    sm.cargar_metricas()
    yield


app = FastAPI(
    title="VinoScore API",
    description="Estima si un caldo de vino blanco es prometedor (calidad 7 o más) "
                "a partir de 11 análisis fisicoquímicos.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def error_de_validacion(_request, exc: RequestValidationError):
    """422 con mensajes cortos. No repite el valor recibido: un NaN o un infinito
    no se pueden escribir en JSON y harían fallar la propia respuesta de error."""
    detalle = [{"campo": ".".join(str(x) for x in e["loc"] if x != "body"), "mensaje": e["msg"]}
               for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": detalle})


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- utilidades
def obtener_config(db: Session) -> Configuracion:
    cfg = db.get(Configuracion, 1)
    if cfg is None:
        cfg = Configuracion(
            id=1,
            umbral_activo=config.UMBRAL_INICIAL,
            costo_falso_premium=config.COSTO_FALSO_PREMIUM_INICIAL,
            costo_bueno_perdido=config.COSTO_BUENO_PERDIDO_INICIAL,
        )
        db.add(cfg)
        db.commit()
    return cfg


def _opciones_lote():
    return (
        selectinload(Lote.analisis).selectinload(Analisis.prediccion),
        selectinload(Lote.decisiones),
    )


def _resumen_lote(lote: Lote, umbral: float) -> dict:
    ultimo = lote.analisis[-1] if lote.analisis else None
    pred = ultimo.prediccion if ultimo else None
    sem = sm.semaforo(pred.probabilidad, umbral) if pred else None
    return {
        "id": lote.id,
        "codigo": lote.codigo,
        "tanque": lote.tanque,
        "fecha": lote.fecha,
        "es_demo": lote.es_demo,
        "capturado_por": ultimo.capturado_por if ultimo else "",
        "analisis_id": ultimo.id if ultimo else None,
        "probabilidad": pred.probabilidad if pred else None,
        "semaforo": sem,
        "etiqueta": sm.etiqueta(sem) if sem else None,
        "decision_actual": lote.decisiones[-1].decision if lote.decisiones else None,
    }


def _lote_o_404(db: Session, lote_id: int) -> Lote:
    lote = db.scalars(
        select(Lote).where(Lote.id == lote_id).options(*_opciones_lote())
    ).first()
    if lote is None:
        raise HTTPException(404, "No existe ese lote.")
    return lote


# --------------------------------------------------------------------- datos
@app.get("/salud", tags=["general"])
def salud():
    return {"estado": "ok", "version_modelo": sm.version_modelo()}


@app.get("/variables", tags=["general"])
def variables():
    """Los 11 análisis: nombre, unidad, orden de captura y rango normal."""
    rangos = sm.cargar_metricas()["rangos_normales"]
    return [{**v, "rango_normal": [rangos[v["clave"]]["p1"], rangos[v["clave"]]["p99"]],
             "rango_dato": [rangos[v["clave"]]["min"], rangos[v["clave"]]["max"]]}
            for v in VARIABLES]


@app.get("/metricas", tags=["general"])
def metricas():
    m = sm.cargar_metricas()
    return {k: m[k] for k in ("version_modelo", "n_vinos", "n_buenos", "n_prueba",
                              "metricas", "importancia_variables")}


# ------------------------------------------------------------------ análisis
@app.post("/analisis", response_model=ResultadoEvaluacion, status_code=201, tags=["lotes"])
def crear_analisis(datos: AnalisisIn, db: Session = Depends(get_db)):
    """Guarda el análisis, corre el modelo y devuelve probabilidad, semáforo y razones."""
    # Idempotencia: si la app reintenta una captura ya guardada, se devuelve la misma.
    if datos.id_cliente:
        previo = db.scalars(select(Analisis).where(Analisis.id_cliente == datos.id_cliente)).first()
        if previo is not None:
            return _resultado(previo, obtener_config(db).umbral_activo)

    cfg = obtener_config(db)
    valores = datos.valores()
    fecha = datos.fecha or ahora()
    if fecha.tzinfo is not None:  # capturas sin conexión llegan con zona horaria
        fecha = fecha.astimezone().replace(tzinfo=None, microsecond=0)

    lote = db.scalars(select(Lote).where(func.lower(Lote.codigo) == datos.codigo.lower())).first()
    if lote is None:
        lote = Lote(codigo=datos.codigo, tanque=datos.tanque, fecha=fecha)
        db.add(lote)
    elif datos.tanque and not lote.tanque:
        lote.tanque = datos.tanque

    resultado = sm.evaluar(valores, cfg.umbral_activo)
    analisis = Analisis(
        lote=lote, id_cliente=datos.id_cliente, capturado_por=datos.capturado_por,
        fecha=fecha, **valores,
    )
    analisis.prediccion = Prediccion(
        probabilidad=resultado["probabilidad"],
        semaforo=resultado["semaforo"],
        umbral_usado=cfg.umbral_activo,
        razones=resultado["razones"],
        advertencias=resultado["advertencias"],
        version_modelo=resultado["version_modelo"],
    )
    db.add(analisis)
    db.commit()
    return _resultado(analisis, cfg.umbral_activo)


def _resultado(analisis: Analisis, umbral: float) -> dict:
    pred = analisis.prediccion
    sem = sm.semaforo(pred.probabilidad, umbral)
    return {
        "lote_id": analisis.lote_id,
        "analisis_id": analisis.id,
        "codigo": analisis.lote.codigo,
        "tanque": analisis.lote.tanque,
        "probabilidad": pred.probabilidad,
        "semaforo": sem,
        "etiqueta": sm.etiqueta(sem),
        "razones": pred.razones,
        "advertencias": pred.advertencias,
        "version_modelo": pred.version_modelo,
    }


# --------------------------------------------------------------------- lotes
def _fin_de_dia(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time()) + timedelta(days=1)


@app.get("/lotes", response_model=list[LoteResumen], tags=["lotes"])
def listar_lotes(
    desde: date | None = Query(None, description="Fecha inicial (incluida)"),
    hasta: date | None = Query(None, description="Fecha final (incluida)"),
    tanque: str | None = None,
    capturado_por: str | None = None,
    semaforo: str | None = Query(None, pattern="^(verde|amarillo|rojo)$"),
    orden: str = Query("probabilidad", pattern="^(probabilidad|fecha)$"),
    limite: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Lotes ordenados por probabilidad (de mayor a menor)."""
    umbral = obtener_config(db).umbral_activo
    q = select(Lote).options(*_opciones_lote())
    if desde:
        q = q.where(Lote.fecha >= datetime.combine(desde, datetime.min.time()))
    if hasta:
        q = q.where(Lote.fecha < _fin_de_dia(hasta))
    if tanque:
        q = q.where(func.lower(Lote.tanque) == tanque.lower())
    filas = [_resumen_lote(lote, umbral) for lote in db.scalars(q).all()]
    if capturado_por:
        filas = [f for f in filas if f["capturado_por"].lower() == capturado_por.lower()]
    if semaforo:
        filas = [f for f in filas if f["semaforo"] == semaforo]
    if orden == "fecha":
        filas.sort(key=lambda f: f["fecha"], reverse=True)
    else:
        filas.sort(key=lambda f: (f["probabilidad"] is None, -(f["probabilidad"] or 0)))
    return filas[:limite]


@app.get("/lotes/{lote_id}", response_model=LoteFicha, tags=["lotes"])
def ficha_lote(lote_id: int, db: Session = Depends(get_db)):
    umbral = obtener_config(db).umbral_activo
    lote = _lote_o_404(db, lote_id)
    base = _resumen_lote(lote, umbral)
    ultimo = lote.analisis[-1] if lote.analisis else None
    pred = ultimo.prediccion if ultimo else None
    return {
        **base,
        "valores": ultimo.valores() if ultimo else {},
        "razones": pred.razones if pred else [],
        "advertencias": pred.advertencias if pred else [],
        "version_modelo": pred.version_modelo if pred else None,
        "decisiones": list(reversed(lote.decisiones)),
    }


@app.get("/resumen", response_model=ResumenOut, tags=["lotes"])
def resumen(db: Session = Depends(get_db)):
    """Tarjetas del tablero: lotes de los últimos 7 días por color de semáforo."""
    umbral = obtener_config(db).umbral_activo
    desde = date.today() - timedelta(days=6)
    q = select(Lote).where(Lote.fecha >= datetime.combine(desde, datetime.min.time())).options(
        *_opciones_lote())
    filas = [_resumen_lote(lote, umbral) for lote in db.scalars(q).all()]
    cuenta = lambda s: sum(1 for f in filas if f["semaforo"] == s)  # noqa: E731
    return {
        "desde": desde,
        "lotes_semana": len(filas),
        "verdes": cuenta("verde"),
        "amarillos": cuenta("amarillo"),
        "rojos": cuenta("rojo"),
        "sin_decision": sum(1 for f in filas if f["decision_actual"] is None),
        "umbral_activo": umbral,
    }


# ----------------------------------------------------------------- decisiones
@app.post("/decisiones", response_model=DecisionOut, status_code=201, tags=["decisiones"])
def crear_decision(datos: DecisionIn, db: Session = Depends(get_db)):
    lote = db.get(Lote, datos.lote_id)
    if lote is None:
        raise HTTPException(404, "No existe ese lote.")
    dec = Decision(lote_id=lote.id, decision=datos.decision, quien=datos.quien,
                   comentario=datos.comentario)
    db.add(dec)
    db.commit()
    return dec


# -------------------------------------------------------------- configuración
@app.get("/configuracion", response_model=ConfiguracionOut, tags=["configuración"])
def leer_configuracion(db: Session = Depends(get_db)):
    return obtener_config(db)


@app.put("/configuracion", response_model=ConfiguracionOut, tags=["configuración"])
def guardar_configuracion(datos: ConfiguracionIO, db: Session = Depends(get_db)):
    cfg = obtener_config(db)
    cfg.umbral_activo = datos.umbral_activo
    cfg.costo_falso_premium = datos.costo_falso_premium
    cfg.costo_bueno_perdido = datos.costo_bueno_perdido
    cfg.actualizado_por = datos.actualizado_por
    cfg.actualizado = ahora()
    db.commit()
    return cfg


@app.get("/perilla", tags=["configuración"])
def perilla(
    costo_falso_premium: float | None = Query(None, ge=0, description="Si se omite, usa el guardado"),
    costo_bueno_perdido: float | None = Query(None, ge=0, description="Si se omite, usa el guardado"),
    db: Session = Depends(get_db),
):
    """Costo esperado de cada umbral y recomendación del más barato."""
    cfg = obtener_config(db)
    c_fp = cfg.costo_falso_premium if costo_falso_premium is None else costo_falso_premium
    c_fn = cfg.costo_bueno_perdido if costo_bueno_perdido is None else costo_bueno_perdido
    resultado = calcular_perilla(sm.cargar_metricas()["umbrales"], c_fp, c_fn)
    resultado["umbral_activo"] = cfg.umbral_activo
    resultado["nota"] = (
        "Se calcula con los 1,188 vinos de prueba del modelo (no con los lotes de la bodega). "
        "Es una guía para decidir, no una garantía."
    )
    return resultado


# ------------------------------------------------------------------ simulador
@app.post("/simular", response_model=SimularOut, tags=["lotes"])
def simular(datos: SimularIn, db: Session = Depends(get_db)):
    """Nueva probabilidad con valores modificados. No guarda nada."""
    umbral = obtener_config(db).umbral_activo
    base: dict[str, float] = {}
    original = None
    if datos.lote_id is not None:
        lote = _lote_o_404(db, datos.lote_id)
        if not lote.analisis:
            raise HTTPException(422, "Ese lote todavía no tiene análisis.")
        ultimo = lote.analisis[-1]
        base = ultimo.valores()
        original = ultimo.prediccion.probabilidad if ultimo.prediccion else sm.predecir(base)
    valores = {**base, **datos.valores}
    faltan = [n for n in NOMBRES_VARIABLES if n not in valores]
    if faltan:
        raise HTTPException(422, f"Faltan valores: {', '.join(faltan)}")
    r = sm.evaluar(valores, umbral)
    return {
        "probabilidad": r["probabilidad"],
        "semaforo": r["semaforo"],
        "etiqueta": r["etiqueta"],
        "probabilidad_original": original,
        "cambio": None if original is None else r["probabilidad"] - original,
        "razones": r["razones"],
        "advertencias": r["advertencias"],
        "valores": valores,
    }


# ------------------------------------------------------------------ exportar
@app.get("/exportar.csv", tags=["lotes"])
def exportar_csv(db: Session = Depends(get_db)):
    """Lotes y decisiones en CSV (abre directo en Excel)."""
    umbral = obtener_config(db).umbral_activo
    lotes = db.scalars(select(Lote).order_by(Lote.fecha.desc()).options(*_opciones_lote())).all()
    salida = io.StringIO()
    w = csv.writer(salida)
    w.writerow(
        ["Lote", "Tanque", "Fecha", "Datos de demostración"]
        + [f"{v['nombre']} ({v['unidad']})" if v["unidad"] else v["nombre"] for v in VARIABLES]
        + ["Probabilidad", "Semáforo", "Resultado", "Decisión", "Decidió", "Fecha de decisión",
           "Comentario"]
    )
    for lote in lotes:
        ult = lote.analisis[-1] if lote.analisis else None
        pred = ult.prediccion if ult else None
        sem = sm.semaforo(pred.probabilidad, umbral) if pred else ""
        dec = lote.decisiones[-1] if lote.decisiones else None
        w.writerow(
            [lote.codigo, lote.tanque, lote.fecha.strftime("%Y-%m-%d %H:%M"),
             "Sí" if lote.es_demo else "No"]
            + [ult.valores()[v["clave"]] if ult else "" for v in VARIABLES]
            + [f"{pred.probabilidad:.3f}" if pred else "", sem,
               sm.etiqueta(sem) if sem else "",
               dec.decision if dec else "", dec.quien if dec else "",
               dec.fecha.strftime("%Y-%m-%d %H:%M") if dec else "",
               dec.comentario if dec else ""]
        )
    contenido = "﻿" + salida.getvalue()  # BOM para que Excel respete los acentos
    return Response(
        contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vinoscore_lotes.csv"'},
    )


# --------------------------------------------- web ya compilada (modo un solo servicio)
_dist = config.RAIZ / "web" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
