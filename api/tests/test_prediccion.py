"""Pruebas de la predicción, el semáforo y las razones."""
import pytest

from api import servicio_modelo as sm
from api.tests.conftest import VINO_NORMAL, VINO_POBRE


def test_probabilidad_entre_0_y_1():
    for vino in (VINO_NORMAL, VINO_POBRE):
        assert 0.0 <= sm.predecir(vino) <= 1.0


def test_vino_prometedor_supera_al_pobre():
    prometedor = {**VINO_NORMAL, "alcohol": 12.8, "density": 0.9900}
    assert sm.predecir(prometedor) > sm.predecir(VINO_POBRE)


def test_predecir_pide_las_11_variables():
    incompleto = {k: v for k, v in VINO_NORMAL.items() if k != "alcohol"}
    with pytest.raises(ValueError, match="alcohol"):
        sm.predecir(incompleto)


@pytest.mark.parametrize(
    "p, umbral, esperado",
    [
        (0.80, 0.5, "verde"),
        (0.50, 0.5, "verde"),      # igual al umbral: verde
        (0.49, 0.5, "amarillo"),
        (0.30, 0.5, "amarillo"),   # 0.3 exacto: amarillo
        (0.29, 0.5, "rojo"),
        (0.00, 0.5, "rojo"),
        (0.35, 0.6, "amarillo"),   # modo "Sello Premium"
        (0.60, 0.6, "verde"),
        (0.30, 0.3, "verde"),      # modo "Filtro a cata": no hay amarillo
        (0.29, 0.3, "rojo"),
    ],
)
def test_semaforo(p, umbral, esperado):
    assert sm.semaforo(p, umbral) == esperado


def test_etiquetas_en_palabras():
    assert sm.etiqueta("verde") == "Prometedor"
    assert sm.etiqueta("amarillo") == "Revisar en cata"
    assert sm.etiqueta("rojo") == "Estándar"


def test_razones_son_3_y_en_lenguaje_simple():
    rs = sm.razones({**VINO_NORMAL, "alcohol": 12.8})
    assert len(rs) == 3
    assert len({r["variable"] for r in rs}) == 3
    for r in rs:
        assert r["efecto"] in {"favorece", "resta", "neutro"}
        assert r["nivel"] in {"alto", "bajo"}
        assert ":" in r["texto"] and "(" in r["texto"]


def test_razon_del_alcohol_alto_favorece():
    rs = sm.razones({**VINO_NORMAL, "alcohol": 12.8})
    assert rs[0]["variable"] == "alcohol"
    assert rs[0]["texto"] == "Alcohol alto (12.8 %): favorece la calidad"


def test_razon_de_alcohol_bajo_resta():
    rs = sm.razones({**VINO_NORMAL, "alcohol": 8.9})
    alcohol = next(r for r in rs if r["variable"] == "alcohol")
    assert alcohol["efecto"] == "resta"
    assert alcohol["texto"].startswith("Alcohol bajo (8.9 %)")


def test_concordancia_de_genero_y_numero():
    rs = sm.razones({**VINO_NORMAL, "chlorides": 0.09, "volatile_acidity": 0.6})
    textos = {r["variable"]: r["texto"] for r in rs}
    if "chlorides" in textos:
        assert textos["chlorides"].startswith("Cloruros altos")
        assert "restan a la calidad" in textos["chlorides"]
    if "volatile_acidity" in textos:
        assert textos["volatile_acidity"].startswith("Acidez volátil alta")


def test_metricas_json_es_coherente():
    m = sm.cargar_metricas()
    assert m["n_buenos"] == 825 and m["n_no_buenos"] == 3135
    assert 0.80 < m["metricas"]["accuracy"] < 0.86
    assert 0.80 < m["metricas"]["auc"] < 0.88
    assert len(m["umbrales"]) == 19
    for fila in m["umbrales"]:
        assert fila["VP"] + fila["FP"] + fila["FN"] + fila["VN"] == m["n_prueba"]
    assert sum(m["importancia_variables"].values()) == pytest.approx(1.0)
    assert set(m["rangos_normales"]) == set(VINO_NORMAL)
    assert set(m["medianas_buenos"]) == set(VINO_NORMAL)
