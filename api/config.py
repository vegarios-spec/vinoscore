"""Configuración de la API (lee variables de entorno / archivo .env)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent
load_dotenv(RAIZ / ".env")

# Para pasar a PostgreSQL basta con cambiar esta variable, por ejemplo:
#   DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/vinoscore
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(RAIZ / 'vinoscore.db').as_posix()}")

RUTA_MODELO = Path(os.getenv("MODELO_PATH", RAIZ / "modelo" / "vinoscore_rf.joblib"))
RUTA_METRICAS = Path(os.getenv("METRICAS_PATH", RAIZ / "modelo" / "metricas.json"))

# Orígenes permitidos para CORS (separados por coma).
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]

# Valores iniciales de la configuración (solo de ejemplo; Sergio los cambia).
UMBRAL_INICIAL = float(os.getenv("UMBRAL_INICIAL", "0.5"))
COSTO_FALSO_PREMIUM_INICIAL = float(os.getenv("COSTO_FALSO_PREMIUM_INICIAL", "500"))
COSTO_BUENO_PERDIDO_INICIAL = float(os.getenv("COSTO_BUENO_PERDIDO_INICIAL", "1500"))

# Límite inferior fijo del semáforo amarillo.
LIMITE_AMARILLO = 0.3
