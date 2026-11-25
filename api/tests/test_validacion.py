"""Pruebas de validación y de los endpoints principales."""
import pytest

from api.tests.conftest import VINO_NORMAL, VINO_POBRE


def test_captura_normal_no_trae_advertencias(client, captura):
    r = client.post("/analisis", json=captura())
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["advertencias"] == []
    assert cuerpo["semaforo"] in {"verde", "amarillo", "rojo"}
    assert len(cuerpo["razones"]) == 3
    assert "aproximada" in cuerpo["nota"]


def test_valor_fuera_de_rango_se_guarda_y_avisa(client, captura):
    r = client.post("/analisis", json=captura(vino={**VINO_NORMAL, "chlorides": 0.25}))
    assert r.status_code == 201
    cuerpo = r.json()
    assert len(cuerpo["advertencias"]) == 1
    assert "Cloruros" in cuerpo["advertencias"][0]
    # Se guardó de todos modos, con la advertencia.
    ficha = client.get(f"/lotes/{cuerpo['lote_id']}").json()
    assert ficha["valores"]["chlorides"] == 0.25
    assert ficha["advertencias"] == cuerpo["advertencias"]


@pytest.mark.parametrize(
    "cambio",
    [
        {"pH": 20},            # imposible
        {"alcohol": -1},       # negativo
        {"density": 0},        # imposible
        {"chlorides": "mucho"},
        {"alcohol": float("nan")},
        {"codigo": "   "},     # código vacío
    ],
)
def test_datos_imposibles_se_rechazan(client, captura, cambio):
    cuerpo = captura()
    cuerpo.update(cambio)
    import json
    r = client.post("/analisis", content=json.dumps(cuerpo), headers={"content-type": "application/json"})
    assert r.status_code == 422
    assert client.get("/lotes").json() == []  # no se guardó nada


def test_falta_una_variable(client, captura):
    cuerpo = captura()
    del cuerpo["sulphates"]
    assert client.post("/analisis", json=cuerpo).status_code == 422


def test_misma_captura_no_se_duplica(client, captura):
    cuerpo = captura(id_cliente="uuid-123")
    a = client.post("/analisis", json=cuerpo).json()
    b = client.post("/analisis", json=cuerpo).json()
    assert a["analisis_id"] == b["analisis_id"]
    assert len(client.get("/lotes").json()) == 1


def test_mismo_codigo_reutiliza_el_lote(client, captura):
    a = client.post("/analisis", json=captura("L-9")).json()
    b = client.post("/analisis", json=captura("l-9", vino=VINO_POBRE)).json()
    assert a["lote_id"] == b["lote_id"]
    ficha = client.get(f"/lotes/{a['lote_id']}").json()
    assert ficha["valores"]["alcohol"] == VINO_POBRE["alcohol"]  # el último análisis


def test_lotes_ordenados_por_probabilidad_y_filtros(client, captura):
    client.post("/analisis", json=captura("BAJO", vino=VINO_POBRE))
    client.post("/analisis", json={**captura("ALTO", vino={**VINO_NORMAL, "alcohol": 12.8, "density": 0.9900}),
                                   "tanque": "T-02"})
    lotes = client.get("/lotes").json()
    assert [l["codigo"] for l in lotes] == ["ALTO", "BAJO"]
    assert lotes[0]["probabilidad"] > lotes[1]["probabilidad"]
    assert [l["codigo"] for l in client.get("/lotes", params={"tanque": "t-02"}).json()] == ["ALTO"]
    assert client.get("/lotes", params={"desde": "2999-01-01"}).json() == []
    assert len(client.get("/lotes", params={"desde": "2000-01-01", "hasta": "2999-12-31"}).json()) == 2


def test_lote_inexistente(client):
    assert client.get("/lotes/999").status_code == 404
    assert client.post("/decisiones", json={"lote_id": 999, "decision": "Premium"}).status_code == 404


def test_decisiones(client, captura):
    lote_id = client.post("/analisis", json=captura()).json()["lote_id"]
    r = client.post("/decisiones", json={"lote_id": lote_id, "decision": "Mandar a cata",
                                         "quien": "Sergio", "comentario": "Probar el lunes"})
    assert r.status_code == 201
    client.post("/decisiones", json={"lote_id": lote_id, "decision": "Premium", "quien": "Sergio"})
    ficha = client.get(f"/lotes/{lote_id}").json()
    assert ficha["decision_actual"] == "Premium"
    assert [d["decision"] for d in ficha["decisiones"]] == ["Premium", "Mandar a cata"]
    # decisión inválida
    assert client.post("/decisiones", json={"lote_id": lote_id, "decision": "Tal vez"}).status_code == 422


def test_simular_no_guarda_nada(client, captura):
    lote_id = client.post("/analisis", json=captura()).json()["lote_id"]
    antes = client.get(f"/lotes/{lote_id}").json()
    sim = client.post("/simular", json={"lote_id": lote_id, "valores": {"alcohol": 13.5}}).json()
    assert sim["probabilidad"] != pytest.approx(antes["probabilidad"])
    assert sim["probabilidad_original"] == pytest.approx(antes["probabilidad"])
    assert sim["cambio"] == pytest.approx(sim["probabilidad"] - antes["probabilidad"])
    despues = client.get(f"/lotes/{lote_id}").json()
    assert despues["valores"] == antes["valores"]
    assert despues["probabilidad"] == antes["probabilidad"]
    assert len(client.get("/lotes").json()) == 1


def test_simular_sin_lote_pide_todos_los_valores(client):
    assert client.post("/simular", json={"valores": {"alcohol": 12}}).status_code == 422
    ok = client.post("/simular", json={"valores": VINO_NORMAL})
    assert ok.status_code == 200
    assert client.post("/simular", json={"valores": {"inventada": 1}}).status_code == 422


def test_configuracion(client):
    cfg = client.get("/configuracion").json()
    assert 0 < cfg["umbral_activo"] <= 1
    r = client.put("/configuracion", json={"umbral_activo": 0.6, "costo_falso_premium": 800,
                                           "costo_bueno_perdido": 2500, "actualizado_por": "Sergio"})
    assert r.status_code == 200
    assert client.get("/configuracion").json()["umbral_activo"] == 0.6
    for malo in ({"umbral_activo": 0}, {"umbral_activo": 1.5}, {"costo_falso_premium": -1}):
        cuerpo = {"umbral_activo": 0.5, "costo_falso_premium": 1, "costo_bueno_perdido": 1, **malo}
        assert client.put("/configuracion", json=cuerpo).status_code == 422


def test_resumen_y_exportar_csv(client, captura):
    client.post("/analisis", json=captura("A"))
    client.post("/analisis", json=captura("B", vino=VINO_POBRE))
    r = client.get("/resumen").json()
    assert r["lotes_semana"] == 2
    assert r["verdes"] + r["amarillos"] + r["rojos"] == 2
    csv = client.get("/exportar.csv")
    assert csv.status_code == 200
    assert "attachment" in csv.headers["content-disposition"]
    lineas = csv.text.strip().splitlines()
    assert len(lineas) == 3  # encabezado + 2 lotes
    assert "Probabilidad" in lineas[0] and "Decisión" in lineas[0]


def test_variables_expone_unidades_y_rangos(client):
    vs = client.get("/variables").json()
    assert len(vs) == 11
    assert all("unidad" in v and "rango_normal" in v for v in vs)
