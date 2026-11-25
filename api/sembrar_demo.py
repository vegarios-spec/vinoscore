"""Crea ~30 lotes de DEMOSTRACIÓN tomados del conjunto de prueba del modelo.

Uso (desde la raíz del proyecto):
    python -m api.sembrar_demo

Son vinos reales del conjunto de datos, NO lotes de la bodega. Se marcan con
es_demo = True y con códigos DEMO-01, DEMO-02... Si se vuelve a correr, borra
los lotes de demostración anteriores y los recrea.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

import pandas as pd
from sklearn.model_selection import train_test_split

from . import config, servicio_modelo as sm
from .db import SessionLocal, crear_tablas
from .main import obtener_config
from .models import Analisis, Decision, Lote, Prediccion
from .variables import ORDEN_MODELO

N_LOTES = 30
TANQUES = ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06"]
ENOLOGA = "Enóloga (demo)"


def muestra_de_prueba(semilla: int = 7) -> pd.DataFrame:
    """30 vinos del conjunto de PRUEBA (los que el modelo nunca vio al entrenar).

    Se reparten por nivel de probabilidad para que la demo muestre los tres
    colores del semáforo: 8 con p >= 0.5, 8 entre 0.3 y 0.5 y 14 con p < 0.3.
    Es una muestra pensada para demostrar, no representa a una bodega real.
    """
    df = pd.read_csv(config.RAIZ / "data" / "vino_limpio.csv")
    y = (df["quality"] >= 7).astype(int)
    _, X_te, _, _ = train_test_split(
        df[ORDEN_MODELO], y, test_size=0.3, stratify=y, random_state=42
    )
    prueba = X_te.copy()
    prueba["p"] = sm.cargar_modelo()["modelo"].predict_proba(prueba[ORDEN_MODELO])[:, 1]
    bandas = [(0.5, 1.01, 8), (0.3, 0.5, 8), (0.0, 0.3, N_LOTES - 16)]
    partes = [
        prueba[(prueba["p"] >= lo) & (prueba["p"] < hi)].sample(n, random_state=semilla)
        for lo, hi, n in bandas
    ]
    return pd.concat(partes).sample(frac=1, random_state=semilla).reset_index(drop=True)


def sembrar(db=None) -> int:
    cerrar = db is None
    db = db or SessionLocal()
    try:
        # Borra la demo anterior (solo lotes marcados como demo).
        for lote in db.query(Lote).filter(Lote.es_demo.is_(True)).all():
            db.delete(lote)
        db.commit()

        umbral = obtener_config(db).umbral_activo
        rng = random.Random(7)
        muestra = muestra_de_prueba()
        ahora = datetime.now().replace(microsecond=0)
        for i, fila in muestra.iterrows():
            valores = {c: float(fila[c]) for c in ORDEN_MODELO}
            # Repartidos en las últimas 3 semanas, de lunes a sábado, horario de laboratorio.
            fecha = ahora - timedelta(days=rng.randint(0, 20), hours=rng.randint(0, 6),
                                      minutes=rng.randint(0, 59))
            lote = Lote(codigo=f"DEMO-{i + 1:02d}", tanque=rng.choice(TANQUES),
                        fecha=fecha, es_demo=True)
            r = sm.evaluar(valores, umbral)
            analisis = Analisis(lote=lote, capturado_por=ENOLOGA, fecha=fecha, **valores)
            analisis.prediccion = Prediccion(
                probabilidad=r["probabilidad"], semaforo=r["semaforo"], umbral_usado=umbral,
                razones=r["razones"], advertencias=r["advertencias"],
                version_modelo=r["version_modelo"], fecha=fecha,
            )
            db.add(analisis)
        db.commit()

        # Unas cuantas decisiones de ejemplo para que el tablero no se vea vacío.
        lotes = db.query(Lote).filter(Lote.es_demo.is_(True)).all()
        con_prob = sorted(lotes, key=lambda l: -l.analisis[-1].prediccion.probabilidad)
        ejemplos = [
            (con_prob[0], "Premium", "Aprobado en la cata de la semana (ejemplo)."),
            (con_prob[1], "Mandar a cata", "Probar con la enóloga antes de decidir (ejemplo)."),
            (con_prob[-1], "Estándar", "Sin cambios (ejemplo)."),
        ]
        for lote, decision, comentario in ejemplos:
            db.add(Decision(lote_id=lote.id, decision=decision, quien="Sergio (demo)",
                            comentario=comentario,
                            fecha=min(lote.fecha + timedelta(days=1), ahora)))
        db.commit()
        return len(lotes)
    finally:
        if cerrar:
            db.close()


if __name__ == "__main__":
    crear_tablas()
    n = sembrar()
    print(f"Listo: {n} lotes de demostración (DEMO-01 a DEMO-{n:02d}).")
