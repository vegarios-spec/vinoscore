"""Entrena el modelo de VinoScore (reproduce el modelo del equipo).

Uso (desde la raíz del proyecto):
    python modelo/entrenar.py

Genera:
    modelo/vinoscore_rf.joblib   el modelo entrenado
    modelo/metricas.json         métricas, importancia, tabla de umbrales,
                                 rangos normales y medianas de vinos buenos
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

RAIZ = Path(__file__).resolve().parent.parent
CSV = RAIZ / "data" / "vino_limpio.csv"
SALIDA_MODELO = RAIZ / "modelo" / "vinoscore_rf.joblib"
SALIDA_METRICAS = RAIZ / "modelo" / "metricas.json"
VERSION_MODELO = "rf-v1"

FEATURES = [
    "fixed_acidity",
    "volatile_acidity",
    "citric_acid",
    "residual_sugar",
    "chlorides",
    "free_sulfur_dioxide",
    "total_sulfur_dioxide",
    "density",
    "pH",
    "sulphates",
    "alcohol",
]

# Métricas de referencia del equipo (para verificar la reproducción).
REFERENCIA = {
    "accuracy": 0.831,
    "precision_bueno": 0.655,
    "recall_bueno": 0.393,
    "f1_bueno": 0.491,
    "auc": 0.846,
}
# Un Random Forest cambia ligeramente entre versiones de scikit-learn aunque
# se use la misma semilla (en la prueba, el recall oscila entre 0.38 y 0.40).
# Aceptamos +-0.02 respecto a las cifras del equipo.
TOLERANCIA = 0.02


def main() -> int:
    df = pd.read_csv(CSV)
    df["good"] = (df["quality"] >= 7).astype(int)
    n_buenos = int(df["good"].sum())
    n_no_buenos = int((df["good"] == 0).sum())
    print(f"Vinos: {len(df)} | buenos: {n_buenos} | no buenos: {n_no_buenos}")
    if (n_buenos, n_no_buenos) != (825, 3135):
        print("ERROR: la distribución esperada es 825 buenos y 3,135 no buenos.")
        return 1

    X = df[FEATURES]
    y = df["good"]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.3, stratify=y, random_state=42
    )

    rf = RandomForestClassifier(n_estimators=150, random_state=42)
    rf.fit(X_tr, y_tr)

    proba = rf.predict_proba(X_te)[:, 1]
    pred = rf.predict(X_te)
    metricas = {
        "accuracy": float(accuracy_score(y_te, pred)),
        "precision_bueno": float(precision_score(y_te, pred)),
        "recall_bueno": float(recall_score(y_te, pred)),
        "f1_bueno": float(f1_score(y_te, pred)),
        "auc": float(roc_auc_score(y_te, proba)),
    }
    print("Métricas en prueba (umbral 0.5):")
    desviado = False
    for k, v in metricas.items():
        ref = REFERENCIA[k]
        marca = "ok" if abs(v - ref) <= TOLERANCIA else "NO COINCIDE"
        if marca != "ok":
            desviado = True
        print(f"  {k:16s} {v:.3f}  (equipo: {ref:.3f})  {marca}")
    if desviado:
        print("\nAVISO: las métricas no coinciden con las del equipo. "
              "No se guardó nada; revisa antes de seguir.")
        return 2

    # Tabla de umbrales 0.05 .. 0.95 (matriz de confusión en prueba)
    umbrales = []
    for u in np.round(np.arange(0.05, 0.951, 0.05), 2):
        p = (proba >= u).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_te, p, labels=[0, 1]).ravel()
        prec = tp / (tp + fp) if (tp + fp) else None
        rec = tp / (tp + fn) if (tp + fn) else None
        umbrales.append({
            "umbral": float(u),
            "VP": int(tp), "FP": int(fp), "FN": int(fn), "VN": int(tn),
            "precision": None if prec is None else float(prec),
            "recall": None if rec is None else float(rec),
        })

    importancia = {
        f: float(i) for f, i in sorted(
            zip(FEATURES, rf.feature_importances_), key=lambda t: -t[1]
        )
    }

    rangos = {
        f: {
            "p1": float(np.percentile(df[f], 1)),
            "p99": float(np.percentile(df[f], 99)),
            "min": float(df[f].min()),
            "max": float(df[f].max()),
        }
        for f in FEATURES
    }
    buenos = df[df["good"] == 1]
    medianas_buenos = {f: float(buenos[f].median()) for f in FEATURES}
    medianas_no_buenos = {f: float(df[df["good"] == 0][f].median()) for f in FEATURES}
    desv_estandar = {f: float(df[f].std()) for f in FEATURES}

    joblib.dump({"modelo": rf, "features": FEATURES, "version": VERSION_MODELO},
                SALIDA_MODELO)
    salida = {
        "version_modelo": VERSION_MODELO,
        "n_vinos": int(len(df)),
        "n_buenos": n_buenos,
        "n_no_buenos": n_no_buenos,
        "n_prueba": int(len(y_te)),
        "n_prueba_buenos": int(y_te.sum()),
        "features": FEATURES,
        "metricas": metricas,
        "importancia_variables": importancia,
        "umbrales": umbrales,
        "rangos_normales": rangos,
        "medianas_buenos": medianas_buenos,
        "medianas_no_buenos": medianas_no_buenos,
        "desviacion_estandar": desv_estandar,
    }
    SALIDA_METRICAS.write_text(json.dumps(salida, indent=2, ensure_ascii=False),
                               encoding="utf-8")
    kb = SALIDA_MODELO.stat().st_size / 1024 / 1024
    print(f"\nGuardado {SALIDA_MODELO.name} ({kb:.1f} MB) y {SALIDA_METRICAS.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
