"""Toma las capturas de pantalla del README con Playwright.

Uso (con la API corriendo en http://localhost:8000 y la web compilada):
    pip install -r requirements-dev.txt
    python -m playwright install chromium
    python docs/tomar_capturas.py

IMPORTANTE: crea un lote de ejemplo (código DEMO-CAPTURA) y cambia la regla
activa. Corre esto con una base de datos de demostración, no con datos reales
de la bodega (después puedes borrar vinoscore.db y volver a sembrar la demo).
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
        pg.wait_for_selector("text=Tus lotes recientes")
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
        pg.evaluate("window.scrollBy(0, -40)")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "enologa-2-captura.png"))

        pg.fill("#chlorides", str(mejor["chlorides"]))
        pg.get_by_role("button", name="Guardar y evaluar").click()
        pg.wait_for_selector("text=Lo que más pesó")
        pg.wait_for_timeout(1200)  # deja terminar la animación del sello
        pg.screenshot(path=str(SALIDA / "enologa-3-resultado.png"))
        ctx.close()

        # --------------------------------------------------------- escritorio (Sergio)
        ctx = b.new_context(viewport={"width": 1366, "height": 860}, locale="es-MX")
        pg = ctx.new_page()
        pg.goto(URL + "/?rol=sergio")
        pg.wait_for_selector("text=Libro de lotes")
        pg.wait_for_selector("main ul li button")
        pg.wait_for_timeout(600)
        pg.screenshot(path=str(SALIDA / "sergio-1-tablero.png"))

        pg.locator("main ul li button").first.click()
        pg.wait_for_selector("text=Lo que más pesó")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(SALIDA / "sergio-2-ficha.png"))

        pg.locator("#sl-alcohol").scroll_into_view_if_needed()
        pg.locator("#sl-alcohol").evaluate(
            "e => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;"
            " s.call(e, String(Number(e.value) - 1.2)); e.dispatchEvent(new Event('input', {bubbles: true})); }"
        )
        pg.wait_for_timeout(800)
        # Baja el panel para que se vean los controles y el resultado juntos.
        pg.locator("text=/La probabilidad (sube|baja)/").first.scroll_into_view_if_needed()
        pg.evaluate("document.querySelector('[role=dialog] .overflow-y-auto').scrollBy(0, 70)")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "sergio-3-simulador.png"))
        pg.keyboard.press("Escape")

        pg.get_by_role("button", name="Regla:", exact=False).click()
        pg.wait_for_selector("text=Gira hasta la regla")
        pg.get_by_role("button", name="El más barato", exact=False).first.click()
        pg.mouse.move(5, 5)  # quita el anillo de foco para que la foto salga limpia
        pg.set_viewport_size({"width": 1366, "height": 1180})
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(SALIDA / "sergio-4-perilla.png"))
        ctx.close()
        b.close()
    print("Capturas guardadas en", SALIDA)


if __name__ == "__main__":
    main()
