"""Revisión de accesibilidad con axe-core (WCAG 2.2 A/AA y buenas prácticas).

Recorre cada pantalla en tema oscuro y claro, en escritorio (1440 px), pantalla
angosta (900 px) y celular (390 px), y guarda los hallazgos en un JSON.

Necesita axe-core (no viene en el proyecto). En una carpeta temporal:
    npm install axe-core          -> node_modules/axe-core/axe.min.js

Uso, con un servidor sobre una base de PRUEBA (captura un lote "AXE-..." por tema):
    python docs/revision_axe.py http://127.0.0.1:8001 <ruta a axe.min.js> hallazgos.json
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

URL, AXE, SALIDA = sys.argv[1], sys.argv[2], sys.argv[3]
ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
AXE_JS = open(AXE, encoding="utf-8").read()

resultados = []


def revisar(pg, pantalla, tema, ancho):
    pg.add_script_tag(content=AXE_JS)
    r = pg.evaluate(
        "async (etq) => await axe.run(document, {runOnly: {type: 'tag', values: etq}, resultTypes: ['violations', 'incomplete']})",
        ETIQUETAS,
    )
    for tipo in ("violations", "incomplete"):
        for v in r[tipo]:
            resultados.append({
                "tipo": "falla" if tipo == "violations" else "revisar",
                "pantalla": pantalla, "tema": tema, "ancho": ancho,
                "regla": v["id"], "impacto": v["impact"], "ayuda": v["help"],
                "nodos": [{"selector": n["target"], "html": n["html"][:200], "detalle": n["failureSummary"] or ""} for n in v["nodes"][:8]],
                "total_nodos": len(v["nodes"]),
            })
    print(f"  {pantalla:34} {tema:6} {ancho:>5}px  fallas {len(r['violations'])}  por revisar {len(r['incomplete'])}")


def pagina(nav, tema, ancho, alto=900):
    ctx = nav.new_context(viewport={"width": ancho, "height": alto})
    ctx.add_init_script(f"localStorage.setItem('vinoscore.tema', '{tema}'); localStorage.setItem('vinoscore.nombre', 'Prueba axe');")
    pg = ctx.new_page()
    pg.set_default_timeout(10000)
    return ctx, pg


def listo(pg):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(700)


with sync_playwright() as p:
    nav = p.chromium.launch()
    for tema in ("oscuro", "claro"):
        # --- Sergio, escritorio
        ctx, pg = pagina(nav, tema, 1440)
        pg.goto(URL + "/?rol=sergio"); listo(pg)
        pg.locator("tbody tr[data-codigo]").first.wait_for()
        revisar(pg, "Sergio: tablero con ficha", tema, 1440)
        # Menú de perfil abierto
        perfil = pg.locator("header button[aria-haspopup], header button[aria-expanded]")
        if perfil.count():
            perfil.last.click(); pg.wait_for_timeout(300)
            revisar(pg, "Sergio: menú de perfil abierto", tema, 1440)
            pg.keyboard.press("Escape")
        # Costo inválido (alerta) y sin lotes con filtros
        pg.locator("#costo-fp").fill("1,5"); pg.wait_for_timeout(500)
        pg.get_by_label("Buscar lote por código").fill("ZZZ"); pg.wait_for_timeout(400)
        revisar(pg, "Sergio: costo inválido y sin lotes", tema, 1440)
        ctx.close()

        # --- Sergio, pantalla angosta con la ficha encima
        ctx, pg = pagina(nav, tema, 900)
        pg.goto(URL + "/?rol=sergio"); listo(pg)
        pg.locator("tbody tr[data-codigo]").nth(1).click(); pg.wait_for_timeout(800)
        revisar(pg, "Sergio: ficha encima (900 px)", tema, 900)
        ctx.close()

        # --- Sergio, celular
        ctx, pg = pagina(nav, tema, 390, 844)
        pg.goto(URL + "/?rol=sergio"); listo(pg)
        revisar(pg, "Sergio: celular", tema, 390)
        ctx.close()

        # --- Enóloga
        ctx, pg = pagina(nav, tema, 390, 844)
        pg.goto(URL + "/?rol=enologa"); listo(pg)
        revisar(pg, "Enóloga: inicio", tema, 390)
        pg.get_by_role("button", name="Capturar lote nuevo").click(); pg.wait_for_timeout(500)
        revisar(pg, "Enóloga: captura vacía", tema, 390)
        # Intentar guardar vacío: errores de "Falta este dato"
        pg.get_by_role("button", name="Guardar y evaluar").click(); pg.wait_for_timeout(400)
        revisar(pg, "Enóloga: captura con faltantes", tema, 390)
        # Llenar con valores (uno fuera de rango) y guardar
        valores = {"density": "0.9940", "alcohol": "11.2", "pH": "3.2", "fixed_acidity": "6.8", "volatile_acidity": "0.28",
                   "citric_acid": "0.33", "residual_sugar": "6.0", "chlorides": "0.9", "sulphates": "0.48",
                   "free_sulfur_dioxide": "35", "total_sulfur_dioxide": "138"}
        pg.locator("#codigo").fill(f"AXE-{tema.upper()}-{int(time.time()) % 100000}")
        for k, v in valores.items():
            pg.locator(f"#{k}").fill(v)
        revisar(pg, "Enóloga: captura llena con aviso", tema, 390)
        pg.get_by_role("button", name="Guardar y evaluar").click()
        pg.get_by_text("Factores principales").first.wait_for()
        pg.wait_for_timeout(500)
        revisar(pg, "Enóloga: resultado", tema, 390)
        ctx.close()

    nav.close()

json.dump(resultados, open(SALIDA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# Resumen por regla
print("\nResumen (regla, tipo, impacto: pantallas)")
agr = {}
for r in resultados:
    clave = (r["regla"], r["tipo"], r["impacto"])
    agr.setdefault(clave, set()).add(f"{r['pantalla']} [{r['tema']}]")
for (regla, tipo, imp), ps in sorted(agr.items(), key=lambda x: (x[0][1], x[0][0])):
    print(f"- {regla} ({tipo}, {imp}): {len(ps)} vistas")
