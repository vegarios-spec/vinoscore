"""Información de cada análisis: nombre en español, unidad, orden de captura.

Esta es la única fuente de verdad: la API la expone en GET /variables y la web
la usa para armar el formulario.

OJO: el orden de captura es una propuesta (POR CONFIRMAR con la enóloga).
Las unidades son las del conjunto de datos Vinho Verde (UCI).
"""
from __future__ import annotations

# clave: nombre de columna en el modelo
# genero/plural: para concordar "alto/alta/altos/altas" en las explicaciones.
VARIABLES: list[dict] = [
    {"clave": "density", "nombre": "Densidad", "unidad": "g/cm³", "decimales": 4,
     "genero": "f", "plural": False, "ayuda": "Se mide con densímetro o con el equipo del laboratorio."},
    {"clave": "alcohol", "nombre": "Alcohol", "unidad": "% vol", "decimales": 1,
     "genero": "m", "plural": False, "ayuda": "Porcentaje de alcohol por volumen."},
    {"clave": "pH", "nombre": "pH", "unidad": "", "decimales": 2,
     "genero": "m", "plural": False, "ayuda": "Qué tan ácido es el vino (normalmente entre 2.8 y 3.8)."},
    {"clave": "fixed_acidity", "nombre": "Acidez fija", "unidad": "g/L", "decimales": 1,
     "genero": "f", "plural": False, "ayuda": "Ácidos propios de la uva (tartárico)."},
    {"clave": "volatile_acidity", "nombre": "Acidez volátil", "unidad": "g/L", "decimales": 2,
     "genero": "f", "plural": False, "ayuda": "Ácido acético; en exceso da olor a vinagre."},
    {"clave": "citric_acid", "nombre": "Ácido cítrico", "unidad": "g/L", "decimales": 2,
     "genero": "m", "plural": False, "ayuda": "Aporta frescura."},
    {"clave": "residual_sugar", "nombre": "Azúcar residual", "unidad": "g/L", "decimales": 1,
     "genero": "m", "plural": False, "ayuda": "Azúcar que queda después de la fermentación."},
    {"clave": "chlorides", "nombre": "Cloruros", "unidad": "g/L", "decimales": 3,
     "genero": "m", "plural": True, "ayuda": "Sal en el vino."},
    {"clave": "sulphates", "nombre": "Sulfatos", "unidad": "g/L", "decimales": 2,
     "genero": "m", "plural": True, "ayuda": "Sulfato de potasio; ayuda a conservar."},
    {"clave": "free_sulfur_dioxide", "nombre": "SO₂ libre", "unidad": "mg/L", "decimales": 0,
     "genero": "m", "plural": False, "ayuda": "Dióxido de azufre libre (el que protege al vino)."},
    {"clave": "total_sulfur_dioxide", "nombre": "SO₂ total", "unidad": "mg/L", "decimales": 0,
     "genero": "m", "plural": False, "ayuda": "Dióxido de azufre total (libre + combinado)."},
]

NOMBRES_VARIABLES: list[str] = [v["clave"] for v in VARIABLES]
POR_CLAVE: dict[str, dict] = {v["clave"]: v for v in VARIABLES}

# Orden de columnas con el que se entrenó el modelo (NO cambiar).
ORDEN_MODELO: list[str] = [
    "fixed_acidity", "volatile_acidity", "citric_acid", "residual_sugar",
    "chlorides", "free_sulfur_dioxide", "total_sulfur_dioxide", "density",
    "pH", "sulphates", "alcohol",
]
