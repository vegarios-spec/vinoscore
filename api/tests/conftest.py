"""Configuración de las pruebas: base de datos temporal, nunca la real."""
import os
import tempfile
from pathlib import Path

# Debe ir ANTES de importar la API para que use una base de datos de prueba.
_tmp = Path(tempfile.mkdtemp(prefix="vinoscore_test_")) / "prueba.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.db import Base, engine  # noqa: E402
from api.main import app  # noqa: E402

# Un vino cercano a la mediana de los vinos buenos (valores normales).
VINO_NORMAL = {
    "fixed_acidity": 6.7, "volatile_acidity": 0.26, "citric_acid": 0.32,
    "residual_sugar": 3.5, "chlorides": 0.036, "free_sulfur_dioxide": 33.0,
    "total_sulfur_dioxide": 120.0, "density": 0.9916, "pH": 3.23,
    "sulphates": 0.48, "alcohol": 11.6,
}
# Un vino que el modelo ve como poco prometedor (alcohol bajo, denso, azucarado).
VINO_POBRE = {
    "fixed_acidity": 7.4, "volatile_acidity": 0.45, "citric_acid": 0.25,
    "residual_sugar": 12.0, "chlorides": 0.06, "free_sulfur_dioxide": 20.0,
    "total_sulfur_dioxide": 190.0, "density": 0.9990, "pH": 3.1,
    "sulphates": 0.45, "alcohol": 9.2,
}


@pytest.fixture()
def client():
    from api import models  # noqa: F401

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def captura():
    """Construye el cuerpo de POST /analisis."""
    def _hacer(codigo="L-001", vino=None, **extra):
        return {"codigo": codigo, "tanque": "T-01", "capturado_por": "Enóloga",
                **(vino or VINO_NORMAL), **extra}
    return _hacer
