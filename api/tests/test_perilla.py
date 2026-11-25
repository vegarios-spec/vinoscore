"""Pruebas de la perilla del dinero."""
import pytest

from api import servicio_modelo as sm
from api.perilla import calcular_perilla


def tabla():
    return sm.cargar_metricas()["umbrales"]


def test_costo_es_fp_y_fn_ponderados_por_100_lotes():
    t = [{"umbral": 0.5, "VP": 10, "FP": 5, "FN": 15, "VN": 70}]  # 100 lotes
    r = calcular_perilla(t, costo_falso_premium=100, costo_bueno_perdido=300)
    assert r["filas"][0]["costo_por_100_lotes"] == pytest.approx(5 * 100 + 15 * 300)


def test_recomienda_el_umbral_mas_barato():
    r = calcular_perilla(tabla(), 500, 1500)
    minimo = min(f["costo_por_100_lotes"] for f in r["filas"])
    assert r["recomendado"]["costo_por_100_lotes"] == pytest.approx(minimo)
    assert r["umbral_recomendado"] == r["recomendado"]["umbral"]


def test_si_un_falso_premium_cuesta_muchisimo_sube_el_umbral():
    caro_fp = calcular_perilla(tabla(), 1_000_000, 1)
    assert caro_fp["umbral_recomendado"] >= 0.85


def test_si_perder_un_bueno_cuesta_muchisimo_baja_el_umbral():
    caro_fn = calcular_perilla(tabla(), 1, 1_000_000)
    assert caro_fn["umbral_recomendado"] == 0.05


def test_umbral_recomendado_se_mueve_con_los_costos():
    barato = calcular_perilla(tabla(), 100, 3000)["umbral_recomendado"]
    caro = calcular_perilla(tabla(), 3000, 100)["umbral_recomendado"]
    assert barato < caro


def test_frase_de_cada_100_premium():
    r = calcular_perilla(tabla(), 500, 1500)
    fila = r["recomendado"]
    assert fila["de_cada_100_premium"] == round(fila["VP"] / (fila["VP"] + fila["FP"]) * 100)
    assert f"{fila['de_cada_100_premium']} sí lo son" in r["frase"]
    assert r["frase"].startswith("Con esta regla, de cada 100 vinos marcados Premium")


def test_sin_vinos_marcados_la_frase_lo_dice():
    t = [{"umbral": 0.95, "VP": 0, "FP": 0, "FN": 10, "VN": 90}]
    r = calcular_perilla(t, 100, 100)
    assert r["recomendado"]["de_cada_100_premium"] is None
    assert "ningún vino" in r["frase"]


def test_costos_negativos_se_rechazan():
    with pytest.raises(ValueError):
        calcular_perilla(tabla(), -1, 100)


def test_empate_prefiere_el_umbral_mas_alto():
    r = calcular_perilla(tabla(), 0, 0)  # todos cuestan 0
    assert r["umbral_recomendado"] == 0.95


def test_endpoint_usa_los_costos_guardados_o_los_recibidos(client):
    base = client.get("/perilla").json()
    assert len(base["filas"]) == 19
    otro = client.get("/perilla", params={"costo_falso_premium": 1_000_000,
                                          "costo_bueno_perdido": 1}).json()
    assert otro["umbral_recomendado"] > base["umbral_recomendado"]
    assert client.get("/perilla", params={"costo_falso_premium": -5}).status_code == 422


def test_activar_el_umbral_recomendado_cambia_el_semaforo(client, captura):
    r = client.post("/analisis", json=captura()).json()
    p = r["probabilidad"]
    client.put("/configuracion", json={"umbral_activo": 0.05, "costo_falso_premium": 1,
                                       "costo_bueno_perdido": 1})
    lote = client.get(f"/lotes/{r['lote_id']}").json()
    assert lote["semaforo"] == "verde"  # p >= 0.05
    client.put("/configuracion", json={"umbral_activo": 0.95, "costo_falso_premium": 1,
                                       "costo_bueno_perdido": 1})
    lote = client.get(f"/lotes/{r['lote_id']}").json()
    assert lote["semaforo"] == ("amarillo" if p >= 0.3 else "rojo")
