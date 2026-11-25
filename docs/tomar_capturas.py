"""Toma las capturas de pantalla del README con Playwright.

Uso (con la API corriendo en http://localhost:8000 y la web compilada):
    pip install -r requirements-dev.txt
    python -m playwright install chromium
    python docs/tomar_capturas.py [URL]

IMPORTANTE: crea un lote de ejemplo (código DEMO-CAPTURA). Corre esto con una base
de datos de demostración, no con datos reales de la bodega (después puedes borrar
vinoscore.db y volver a sembrar la demo).
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
SALIDA = Path(__file__).resolve().parent / "capturas"
SALIDA.mkdir(exist_ok=True)

MOVER = (
    "(e, d) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;"
    " s.call(e, String(Number(e.value) + d)); e.dispatchEvent(new Event('input', {bubbles: true})); }"
)


def api(ruta: str):
    return json.loads(urllib.request.urlopen(URL + ruta).read())


def main() -> None:
    # Valores reales de un lote de demostración prometedor, para que la captura se vea natural.
    mejor = api(f"/lotes/{api('/lotes')[0]['id']}")["valores"]

    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------------------------------------------------------- celular (390 px)
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale="es-MX")
        pg = ctx.new_page()
        pg.goto(URL + "/?rol=enologa")
        pg.wait_for_selector("text=Recientes")
        pg.wait_for_selector("main ul li button")
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(SALIDA / "enologa-1-inicio.png"))

        pg.get_by_role("button", name="Capturar lote nuevo").click()
        pg.wait_for_selector("text=Lote nuevo")
        pg.fill("#codigo", "DEMO-CAPTURA")
        pg.fill("#tanque", "T-02")
        for clave, valor in mejor.items():
            pg.fill(f"#{clave}", str(valor))
        pg.fill("#chlorides", "0.25")  # un valor fuera de lo normal, para mostrar el aviso
        pg.locator("#chlorides").scroll_into_view_if_needed()
        pg.evaluate("window.scrollBy(0, 120)")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "enologa-2-captura.png"))

        pg.fill("#chlorides", str(mejor["chlorides"]))
        pg.get_by_role("button", name="Guardar y evaluar").click()
        pg.wait_for_selector("text=Factores principales")
        pg.wait_for_timeout(800)
        pg.screenshot(path=str(SALIDA / "enologa-3-resultado.png"))
        ctx.close()

        # --------------------------------------------------------- escritorio (Sergio)
        for tema, archivo in (("oscuro", "sergio-1-tablero.png"), ("claro", "sergio-3-claro.png")):
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, locale="es-MX")
            ctx.add_init_script(f"try {{ localStorage.setItem('vinoscore.tema', '{tema}') }} catch (e) {{}}")
            pg = ctx.new_page()
            pg.goto(URL + "/?rol=sergio")
            pg.wait_for_selector("tbody tr[data-codigo]")
            pg.wait_for_selector("text=Factores principales")
            pg.wait_for_timeout(800)
            pg.screenshot(path=str(SALIDA / archivo))

            if tema == "oscuro":
                # La ficha con el simulador en uso: baja la columna de la ficha hasta el simulador.
                pg.locator("#sl-alcohol").evaluate(MOVER, -1.2)
                pg.wait_for_selector("text=/La probabilidad (sube|baja)/")
                pg.evaluate("document.querySelector('aside').scrollTo(0, document.getElementById('sim-titulo').offsetTop - 24)")
                pg.evaluate("window.scrollTo(0, document.querySelector('aside').getBoundingClientRect().top + window.scrollY - 70)")
                pg.mouse.move(5, 5)
                pg.wait_for_timeout(400)
                pg.screenshot(path=str(SALIDA / "sergio-2-ficha.png"))
            ctx.close()
        b.close()
    print("Capturas guardadas en", SALIDA)


if __name__ == "__main__":
    main()
