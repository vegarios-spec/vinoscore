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
import re
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


JS_MOVER = (
    "(e, d) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;"
    " s.call(e, String(Number(e.value) + d)); e.dispatchEvent(new Event('input', {bubbles: true})); }"
)


def aparece(loc, ms: int = 5000) -> bool:
    """Espera a que el elemento se vea (las respuestas de la API tardan un poco)."""
    try:
        loc.first.wait_for(state="visible", timeout=ms)
        return True
    except Exception:
        return False


def solo_digitos(t: str) -> str:
    return "".join(c for c in t if c.isdigit())


def codigo_ficha(pg: Page) -> str:
    return pg.get_by_role("region", name="Ficha del lote").locator("h2").first.inner_text()


# -------------------------------------------------------------------- sergio
def seccion_sergio(nav, url: str) -> None:
    print("sergio")
    regla_inicial(url)
    ctx = nav.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    pg.goto(url + "/?rol=sergio")
    pg.wait_for_load_state("networkidle")
    filas = pg.locator("tbody tr[data-codigo]")
    filas.first.wait_for()

    # Todo a la vista sin hacer clic.
    for desc, loc in [
        ("umbral", pg.locator("#umbral")),
        ("costo falso Premium", pg.locator("#costo-fp")),
        ("costo bueno perdido", pg.locator("#costo-fn")),
        ("modo Sello Premium", pg.get_by_role("button", name="Sello Premium")),
        ("gráfica de costo", pg.get_by_role("group", name="Costo esperado por cada 100 lotes, según el umbral")),
        ("tabla de lotes", pg.get_by_role("table", name="Lotes")),
        ("ficha del lote", pg.get_by_role("region", name="Ficha del lote")),
    ]:
        revisar(loc.count() > 0 and loc.first.is_visible(), f"se ve sin clics: {desc}")
    primero = filas.first.get_attribute("data-codigo")
    pg.get_by_role("region", name="Ficha del lote").locator("h2").first.wait_for()
    revisar(codigo_ficha(pg).startswith(f"Lote {primero}"), f"la ficha abre con el lote más prometedor ({primero})")

    # Contadores que filtran.
    filtros = pg.get_by_role("group", name="Filtrar por semáforo")
    filtros.get_by_role("button", name="Estándar").click()
    sems = set(filas.evaluate_all("rs => rs.map(r => r.dataset.semaforo)"))
    revisar(sems == {"rojo"}, f"el contador Estándar deja solo lotes estándar ({sems})")
    filtros.get_by_role("button", name="Estándar").click()
    revisar(len(set(filas.evaluate_all("rs => rs.map(r => r.dataset.semaforo)"))) > 1, "otro clic quita el filtro")

    # Búsqueda.
    pg.get_by_label("Buscar lote por código").fill("DEMO-1")
    codigos = filas.evaluate_all("rs => rs.map(r => r.dataset.codigo)")
    revisar(bool(codigos) and all("DEMO-1" in c for c in codigos), "la búsqueda filtra por código")
    pg.get_by_label("Buscar lote por código").fill("")

    # Elegir otra fila cambia la ficha.
    tercero = filas.nth(2).get_attribute("data-codigo")
    filas.nth(2).click()
    pg.wait_for_timeout(500)
    revisar(codigo_ficha(pg).startswith(f"Lote {tercero}"), "clic en otra fila cambia la ficha")
    revisar(filas.nth(2).get_attribute("aria-selected") == "true", "la fila elegida queda marcada")

    # Simulador.
    # Hacia abajo: los lotes más prometedores suelen tener el alcohol cerca del tope del control.
    pg.locator("#sl-alcohol").evaluate(JS_MOVER, -1.2)
    pg.wait_for_timeout(900)
    cambio = pg.get_by_text(re.compile("La probabilidad (sube|baja)"))
    if not aparece(cambio):
        print("    simulador muestra:", pg.locator("#sim-titulo").locator("xpath=../..").inner_text()[:400].replace("\n", " | "))
    revisar(cambio.count() > 0, "el simulador recalcula")

    # Decisión.
    ficha = pg.get_by_role("region", name="Ficha del lote")
    ficha.get_by_label("Comentario").fill("Probar el viernes")
    ficha.get_by_role("button", name="Mandar a cata").click()
    revisar(aparece(ficha.get_by_text("Listo: el lote quedó como Mandar a cata.")), "la decisión se guarda")
    pg.wait_for_timeout(600)
    fila = pg.locator(f'tbody tr[data-codigo="{tercero}"]')
    revisar("Mandar a cata" in fila.inner_text(), "la tabla muestra la decisión nueva")

    # Umbral con teclado y activar.
    pg.locator("#umbral").focus()
    pg.keyboard.press("ArrowRight")
    revisar(pg.locator("#umbral").input_value() == "0.55", "flecha derecha sube el umbral a 0.55")
    pg.get_by_role("button", name="Activar umbral 0.55").click()
    revisar(aparece(pg.get_by_text("Regla activada: Prometedor desde 0.55")), "se activa la regla 0.55")

    # Costos con separador de miles.
    pg.locator("#costo-fp").fill("1,500")
    pg.wait_for_timeout(900)
    datos = api(url, "/perilla?costo_falso_premium=1500&costo_bueno_perdido=1500")
    fila_055 = next(f for f in datos["filas"] if abs(f["umbral"] - 0.55) < 1e-6)
    esperado = solo_digitos(f"{round(fila_055['costo_por_100_lotes']):,}")
    mostrado = solo_digitos(pg.locator("#costo-esperado").inner_text())
    revisar(mostrado == esperado, f"'1,500' se lee como 1500 (costo {mostrado} vs {esperado})")

    # Sin lotes que mostrar.
    pg.get_by_label("Buscar lote por código").fill("ZZZ")
    revisar(pg.get_by_role("region", name="Ficha del lote").get_by_text("No hay lotes con estos filtros").count() > 0,
            "la ficha dice que no hay lotes con estos filtros")
    esquinas(pg, "Sergio")
    revisar(pg.evaluate(JS_DESBORDE), "sin desplazamiento horizontal a 1440 px")
    ctx.close()

    # Falla de /perilla: lo demás sigue funcionando.
    ctx = nav.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    pg.route("**/perilla**", lambda r: r.fulfill(status=500, body="{}"))
    pg.goto(url + "/?rol=sergio")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(800)
    revisar(pg.get_by_text("No se pudo calcular la regla.").count() > 0, "si /perilla falla, la banda lo dice")
    filas = pg.locator("tbody tr[data-codigo]")
    segundo = filas.nth(1).get_attribute("data-codigo")
    filas.nth(1).click()
    pg.wait_for_timeout(500)
    revisar(codigo_ficha(pg).startswith(f"Lote {segundo}"), "si /perilla falla, la tabla y la ficha siguen")
    ctx.close()

    # Pantalla angosta: la ficha se abre encima y Esc la cierra.
    ctx = nav.new_context(viewport={"width": 900, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    pg.goto(url + "/?rol=sergio")
    pg.wait_for_load_state("networkidle")
    filas = pg.locator("tbody tr[data-codigo]")
    filas.nth(1).click()
    revisar(pg.get_by_role("dialog").count() == 1, "a 900 px la ficha se abre encima")
    pg.keyboard.press("Escape")
    revisar(pg.get_by_role("dialog").count() == 0, "Esc cierra la ficha")
    revisar(pg.evaluate(JS_DESBORDE), "sin desplazamiento horizontal a 900 px")
    ctx.close()
    regla_inicial(url)


SECCIONES = {"tema": seccion_tema, "sergio": seccion_sergio}


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
