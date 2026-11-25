"""Prueba de interfaz de VinoScore con Playwright (Chromium).

Uso (con la API corriendo y la web compilada):

    python docs/prueba_interfaz.py http://localhost:8001            # todas las secciones
    python docs/prueba_interfaz.py http://localhost:8001 --solo tema

Secciones: tema, sergio, enologa. La sección "sergio" cambia la regla activa y guarda
decisiones en la base de la API a la que apunta: úsala con una base de pruebas, nunca
con la de la bodega. Al terminar deja la regla en 0.5 con costos de 500 y 1,500.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request

from playwright.sync_api import Page, sync_playwright

FALLAS: list[str] = []


def revisar(condicion: bool, mensaje: str) -> None:
    print(("  ok    " if condicion else "  FALLA ") + mensaje)
    if not condicion:
        FALLAS.append(mensaje)


def api(url: str, ruta: str, metodo: str = "GET", cuerpo: dict | None = None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(url + ruta, data=datos, method=metodo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def regla_inicial(url: str) -> None:
    api(url, "/configuracion", "PUT", {
        "umbral_activo": 0.5, "costo_falso_premium": 500, "costo_bueno_perdido": 1500, "actualizado_por": "prueba",
    })


# Elementos visibles con alguna esquina redonda (la regla del dueño: ninguna).
JS_ESQUINAS = """() => [...document.querySelectorAll('body *')].filter(e => {
  const r = e.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const s = getComputedStyle(e);
  return ['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius']
    .some(k => s[k] !== '0px');
}).slice(0, 30).map(e => e.tagName.toLowerCase() + ' ' + String(e.getAttribute('class') || '').slice(0, 70))"""

JS_DESBORDE = "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth"


def esquinas(pg: Page, donde: str) -> None:
    n = pg.evaluate("document.querySelectorAll('body button, body input').length")
    revisar(n >= 3, f"{donde}: la app cargó ({n} botones y campos)")
    redondas = pg.evaluate(JS_ESQUINAS)
    revisar(not redondas, f"{donde}: ninguna esquina redonda" + ("" if not redondas else f" (hay {len(redondas)}: {redondas[:6]})"))


# ---------------------------------------------------------------------- tema
def seccion_tema(nav, url: str) -> None:
    print("tema")
    ctx = nav.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    errores: list[str] = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.goto(url + "/?rol=sergio")
    pg.wait_for_load_state("networkidle")
    revisar(pg.evaluate("document.documentElement.dataset.tema") == "oscuro", "abre en tema oscuro por defecto")
    revisar(pg.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(20, 21, 22)", "fondo oscuro #141516")
    esquinas(pg, "Sergio")

    pg.get_by_role("button", name="Cambiar a tema claro").click()
    revisar(pg.evaluate("document.documentElement.dataset.tema") == "claro", "el interruptor cambia a claro")
    pg.reload()
    pg.wait_for_load_state("networkidle")
    revisar(pg.evaluate("document.documentElement.dataset.tema") == "claro", "el tema claro se recuerda al recargar")
    revisar(pg.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(247, 247, 245)", "fondo claro #F7F7F5")
    pg.get_by_role("button", name="Cambiar a tema oscuro").click()

    pg.goto(url + "/?rol=enologa")
    pg.wait_for_load_state("networkidle")
    esquinas(pg, "Enóloga")
    revisar(not errores, "sin errores de JavaScript" + (f": {errores}" if errores else ""))
    ctx.close()

    # Con el almacenamiento del navegador bloqueado la app abre igual, en oscuro.
    ctx = nav.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });")
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    errores = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.goto(url + "/?rol=sergio")
    pg.wait_for_load_state("networkidle")
    revisar(pg.evaluate("document.documentElement.dataset.tema") == "oscuro", "sin localStorage abre en oscuro")
    revisar(not errores, "sin localStorage no hay errores" + (f": {errores[:2]}" if errores else ""))
    boton = pg.get_by_role("button", name="Cambiar a tema claro")
    if boton.count():
        boton.click()
        revisar(pg.evaluate("document.documentElement.dataset.tema") == "claro", "sin localStorage el interruptor funciona")
    else:
        revisar(False, "sin localStorage se ve el interruptor de tema")
    ctx.close()


SECCIONES = {"tema": seccion_tema}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("url", nargs="?", default="http://localhost:8001")
    p.add_argument("--solo", choices=sorted(SECCIONES))
    a = p.parse_args()
    url = a.url.rstrip("/")
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        try:
            for nombre, fn in SECCIONES.items():
                if a.solo in (None, nombre):
                    fn(nav, url)
        finally:
            nav.close()
            try:
                regla_inicial(url)
            except Exception:  # la API puede estar apagada; no oculta las fallas
                pass
    print(f"\n{len(FALLAS)} falla(s)" if FALLAS else "\nTodo bien")
    return 1 if FALLAS else 0


if __name__ == "__main__":
    sys.exit(main())
