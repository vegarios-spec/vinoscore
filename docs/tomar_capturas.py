"""Toma las capturas de pantalla del README con Playwright.

Uso (con la API corriendo en http://localhost:8000 y la web compilada):
    pip install -r requirements-dev.txt
    python -m playwright install chromium
    python docs/tomar_capturas.py

IMPORTANTE: crea un lote de ejemplo (código DEMO-CAPTURA). Corre esto con una
base de datos de demostración, no con datos reales de la bodega.
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
    lotes = api("/lotes")
    mejor = api(f"/lotes/{lotes[0]['id']}")
    valores = mejor["valores"]

    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------------------------------------------------------- celular (390 px)
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale="es-MX")
        pg = ctx.new_page()
        pg.goto(URL)
        pg.wait_for_selector("text=1. Densidad")
        pg.screenshot(path=str(SALIDA / "enologa-1-formulario.png"))

        pg.fill("#codigo", "DEMO-CAPTURA")
        pg.fill("#tanque", "T-02")
        for clave, valor in valores.items():
            pg.fill(f"#{clave}", str(valor))
        pg.fill("#chlorides", "0.25")  # un valor fuera de lo normal, para mostrar el aviso
        pg.locator("#chlorides").scroll_into_view_if_needed()
        pg.evaluate("window.scrollBy(0, 120)")
        pg.screenshot(path=str(SALIDA / "enologa-2-aviso.png"))

        pg.fill("#chlorides", str(valores["chlorides"]))
        pg.get_by_role("button", name="Guardar y evaluar").click()
        pg.wait_for_selector("text=Por qué salió así")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "enologa-3-resultado.png"))
        ctx.close()

        # --------------------------------------------------------- escritorio (Sergio)
        ctx = b.new_context(viewport={"width": 1366, "height": 860}, locale="es-MX")
        pg = ctx.new_page()
        pg.goto(URL + "/?rol=sergio")
        pg.wait_for_selector("table")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "sergio-1-tablero.png"))

        pg.locator("tbody tr").first.click()
        pg.wait_for_selector("text=Tu decisión")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(SALIDA / "sergio-2-ficha.png"))

        pg.get_by_role("button", name="Perilla del dinero").click()
        pg.wait_for_selector("text=Costo esperado por cada 100 lotes")
        pg.wait_for_timeout(600)
        pg.set_viewport_size({"width": 1366, "height": 1500})
        pg.screenshot(path=str(SALIDA / "sergio-3-perilla.png"))
        pg.set_viewport_size({"width": 1366, "height": 860})

        pg.get_by_role("button", name="¿Qué pasa si…?").click()
        pg.wait_for_selector("text=Con tus cambios")
        pg.locator("#sl-alcohol").evaluate(
            "e => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;"
            " s.call(e, String(Number(e.value) - 1.2)); e.dispatchEvent(new Event('input', {bubbles: true})); }"
        )
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(SALIDA / "sergio-4-simulador.png"))
        ctx.close()
        b.close()
    print("Capturas guardadas en", SALIDA)


if __name__ == "__main__":
    main()
