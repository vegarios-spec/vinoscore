# Rediseño "herramienta" (oscuro, sobrio, sin esquinas redondas) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar el estilo de la web de VinoScore a una herramienta profesional: modo oscuro por defecto con opción clara, paleta monocroma, esquinas rectas, una sola tipografía y todas las funciones a la vista.

**Architecture:** Solo cambia `web/`. Los colores pasan a variables CSS por tema (`data-tema` en `<html>`), expuestas a Tailwind v4 con `@theme inline`. Sergio pasa de paneles deslizables a un espacio de trabajo: banda "Regla de decisión" arriba, tabla de lotes a la izquierda y ficha del lote a la derecha. La enóloga conserva su flujo con campos más claros.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind v4, vite-plugin-pwa, `@fontsource/ibm-plex-sans`; pruebas de interfaz con Playwright (Python, ya instalado en `C:\Users\Elias\vinoscore\.venv`).

**Spec:** `docs/superpowers/specs/2026-11-25-rediseno-oscuro-design.md`

## Global Constraints

- `border-radius` 0 en todo elemento (cajas, paneles, tablas, campos, botones, barras, marcadores). Ninguna clase `rounded*`, ningún `rx` en SVG.
- Tema por defecto: oscuro. Clave de `localStorage`: `vinoscore.tema`, valores `"oscuro" | "claro"`. Atributo: `document.documentElement.dataset.tema`.
- Colores exactos (oscuro / claro): fondo `#141516`/`#F7F7F5`, superficie `#1C1D1F`/`#FFFFFF`, línea `#2E3033`/`#DADAD7`, texto `#ECECEA`/`#17181A`, suave `#9C9EA1`/`#5E6064`, verde `#6CBF78`/`#2F7A3B`, ámbar `#E3B341`/`#8A6100`, rojo `#E8685A`/`#B3372B`. Botón primario = fondo `texto`, letra `fondo`.
- Tipografía única IBM Plex Sans (400, 500, 600). Escala 12/14/16/20/28/44 px. Cifras con `tabular-nums`. Sin mayúsculas espaciadas, sin "·" para unir datos, sin sombras ni degradados.
- Textos en español de México. Renombres fijos: "La perilla del dinero" → "Regla de decisión"; "Libro de lotes" → "Lotes"; "¿Qué pasa si…?" → "Simulador"; "Lo que más pesó" → "Factores principales"; "Avísale a Sergio" → "Avisar a dirección". Las palabras del semáforo (Prometedor / Revisar en cata / Estándar) y de las decisiones no cambian.
- No tocar `api/`, `modelo/` ni la base de datos del usuario. Las pruebas usan la base del worktree en el puerto 8001.
- Sin push. Commits locales con el correo noreply ya configurado en el repo.

## Review Focus

1. Costos escritos con separador de miles ("1,500") en la banda de regla → deben leerse como 1500, no 1.5 (hoy `leerNumero` cambia la coma por punto). Prueba en Task 2.
2. Periodo sin lotes (p. ej. "Últimos 7 días" vacío) → la columna de ficha muestra un estado vacío con indicación, sin pantalla en blanco ni error. Prueba en Task 2.
3. Falla de una sola parte de la API con la pantalla de Sergio abierta (p. ej. `/perilla` responde 500) → esa zona muestra su mensaje de error y la tabla y la ficha siguen funcionando. Prueba en Task 2. (La API no permite lotes sin análisis, así que ese caso no aplica.)
4. `localStorage` bloqueado (lanza excepción) → la app abre en oscuro y el interruptor sigue funcionando en la sesión. Prueba en Task 1.
5. Códigos de lote largos (30 caracteres) → se recortan con "…" en la tabla y no provocan desplazamiento horizontal a 1024 px ni a 390 px. Prueba en Task 3.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `web/src/index.css` | Tokens de color por tema, tipografía, `.campo`, foco, movimiento reducido |
| `web/src/tema.ts` (nuevo) | Leer, aplicar y guardar el tema |
| `web/index.html`, `web/vite.config.ts` | Tema inicial sin parpadeo; `theme_color`/`background_color` oscuros |
| `web/src/ui.tsx` | Primitivos: `Boton`, `Marcador`, `InsigniaSemaforo`, `InsigniaDemo`, `BarraProbabilidad`, `ListaRazones`, `Avisos`, `Cargando`, `ErrorCaja`, `Vacio` |
| `web/src/Cabecera.tsx` | Barra superior + interruptor de tema + menú de perfil |
| `web/src/vistas/Regla.tsx` (nuevo) | Banda "Regla de decisión" (antes `PerillaPanel.tsx` + `Dial.tsx`) |
| `web/src/vistas/FichaLote.tsx` | `FichaLote` sin envoltura: contenido de la ficha, simulador y decisión |
| `web/src/vistas/Sergio.tsx` | Espacio de trabajo: banda, contadores/filtros, tabla, ficha (columna o `Panel` bajo 1024 px) |
| `web/src/vistas/Enologa.tsx` | Inicio, captura, resultado, pendiente |
| `web/src/util.ts` | `leerPesos` nuevo; textos de `SEMAFORO` |
| `docs/prueba_interfaz.py` (nuevo) | Prueba de interfaz con Playwright, por secciones (`--solo tema|sergio|enologa`) |
| Se borran | `web/src/Sello.tsx`, `web/src/Dial.tsx`, `web/src/vistas/PerillaPanel.tsx` |

**Cómo correr el entorno de prueba (todas las tareas):**

```bash
PY=/c/Users/Elias/vinoscore/.venv/Scripts/python.exe
export PATH="$PATH:/c/Program Files/nodejs"
(cd web && npm run build)                     # tsc --noEmit + vite build
$PY -m api.sembrar_demo --solo-si-vacio        # base propia del worktree
$PY -m uvicorn api.main:app --port 8001        # en segundo plano
PYTHONUTF8=1 $PY docs/prueba_interfaz.py http://localhost:8001 --solo <seccion>
```

Antes de cada corrida de `sergio`, la prueba restablece la regla con `PUT /configuracion` (umbral 0.5, costos 500 y 1500).

---

### Task 1: Tokens, tema oscuro por defecto, tipografía y primitivos

**Files:**
- Create: `web/src/tema.ts`, `docs/prueba_interfaz.py`
- Modify: `web/src/index.css`, `web/index.html`, `web/vite.config.ts`, `web/package.json`, `web/src/main.tsx`, `web/src/ui.tsx`, `web/src/Cabecera.tsx`

**Interfaces:**
- Produces:
  - `type Tema = "oscuro" | "claro"`; `leerTema(): Tema` (oscuro si no hay valor o `localStorage` falla); `aplicarTema(t: Tema): void` (pone `dataset.tema` y guarda, tolerando fallas de `localStorage`).
  - Clases Tailwind de color: `bg-fondo bg-superficie border-linea text-texto text-suave bg-primario text-sobre-primario` y `verde|ambar|rojo` como `text-*`, `bg-*`, `border-*`.
  - `Marcador({ tipo: Semaforo | "pendiente", tam?: number })`: cuadrado sólido de `tam` px (10 por defecto) con `aria-hidden`.
  - `BarraProbabilidad({ p: number, semaforo: Semaforo, umbral: number, alto?: number, marcas?: number[] })`: barra recta, relleno del color del semáforo, línea vertical en `umbral` y en cada `marcas`.
  - `Boton` con variantes `"primario" | "secundario" | "fantasma"` (sin `rounded`).
  - `Cabecera` agrega un botón con `aria-label="Cambiar a tema claro"` / `"Cambiar a tema oscuro"`.

- [ ] **Step 1: Escribir `docs/prueba_interfaz.py` con la sección `tema`.** Recibe la URL y `--solo`. Asserts:
  - al abrir `/?rol=sergio` con almacenamiento limpio, `document.documentElement.dataset.tema == "oscuro"` y el color de fondo calculado de `body` es `rgb(20, 21, 22)`;
  - un clic en el botón "Cambiar a tema claro" deja `dataset.tema == "claro"`, y sigue en claro después de recargar;
  - con `localStorage` bloqueado (`add_init_script` que hace lanzar `localStorage.getItem` y `setItem`), la página abre en `"oscuro"` sin errores en consola;
  - **ninguna esquina redonda:** en `/?rol=sergio` y `/?rol=enologa`, para todo elemento visible, `getComputedStyle(el).borderTopLeftRadius == "0px"` (lista los que fallen).
- [ ] **Step 2: Correrla y ver que falla** (hoy no existe `dataset.tema` y hay `rounded-*`). Esperado: FAIL en la primera aserción.
- [ ] **Step 3: Implementar.** Cambiar `@fontsource-variable/inter` y `@fontsource-variable/newsreader` por `@fontsource/ibm-plex-sans` (pesos 400, 500, 600). En `index.css`, variables por tema en `:root` (oscuro) y `:root[data-tema="claro"]`, puenteadas con `@theme inline { --color-fondo: var(--fondo); … }`; `.campo` recto, fondo `superficie`, foco con borde `texto`; quitar `.font-display`, `.sello-estampa`. `index.html`: script en línea antes del bundle que aplica el tema guardado (oscuro si falla) y `theme-color` `#141516`. `vite.config.ts`: `background_color` y `theme_color` `#141516`. `tema.ts` y primitivos según Interfaces. `InsigniaSemaforo` usa `Marcador`. `Cabecera`: fondo `fondo`, borde inferior `linea`, nombre "VinoScore" en 500, interruptor de tema, menú de perfil recto. `main.tsx` llama `aplicarTema(leerTema())`.
- [ ] **Step 4: `npm run build` y la sección `tema`.** Esperado: build sin errores y sección `tema` PASS, salvo la aserción de esquinas en elementos de vistas aún no migradas (que debe listar solo elementos de `Sergio.tsx`, `FichaLote.tsx`, `PerillaPanel.tsx`, `Enologa.tsx`, `Panel.tsx`, `Sello.tsx`, `Dial.tsx`).
- [ ] **Step 5: Commit** `web: tema oscuro por defecto, tokens y tipografía IBM Plex Sans`.

### Task 2: Sergio — banda "Regla de decisión", tabla de lotes y ficha a la vista

**Files:**
- Create: `web/src/vistas/Regla.tsx`
- Modify: `web/src/vistas/Sergio.tsx`, `web/src/vistas/FichaLote.tsx`, `web/src/Panel.tsx`, `web/src/util.ts`, `docs/prueba_interfaz.py`
- Delete: `web/src/vistas/PerillaPanel.tsx`, `web/src/Dial.tsx`

**Interfaces:**
- Consumes: Task 1 primitivos y clases.
- Produces:
  - `leerPesos(texto: string): number | null` en `util.ts`: quita `$`, espacios y comas de miles; acepta un punto decimal; `null` si no es número.
  - `Regla({ onConfigCambia: (c: Configuracion) => void })`: banda completa. Contiene costos (`#costo-fp`, `#costo-fn`, leídos con `leerPesos`), control deslizante `input type="range"` con `id="umbral"`, `aria-label="Umbral"`, min 0.05, max 0.95, paso 0.05; botones "Filtro a cata 0.30", "Sello Premium 0.60", "Más barato X"; cifras (marcados, falsos Premium, buenos perdidos por cada 100) y costo esperado; la gráfica de barras actual (clic en barra = probar ese umbral, barras rectas); botón "Activar umbral X" / "Esta regla ya está activa"; mensaje "Regla activada: Prometedor desde X.".
  - `FichaLote({ resumen, variables, umbral, onDecidido })`: sin `Panel` ni `onCerrar`. Encabezado con código, DEMO, tanque, fecha y quién capturó; "69 %" en 44 px con `InsigniaSemaforo` y `BarraProbabilidad`; significado, frase, decisión actual; avisos; "Factores principales"; "Simulador" (mismos 3 controles); tabla "Análisis del lote" abierta (sin `<details>`); "Decisiones anteriores"; comentario y botones "Aprobar como Premium" (primario), "Mandar a cata", "Estándar".
  - `Panel` conserva su API pero recto, fondo `fondo`, sin sombra; solo se usa bajo 1024 px.

- [ ] **Step 1: Agregar la sección `sergio` a la prueba.** A 1440×900, sin hacer clic en nada, son visibles: `#umbral`, `#costo-fp`, `#costo-fn`, botón "Sello Premium", la gráfica (`role=group` "Costo esperado…"), la tabla (`role=table`) y la ficha del primer lote (encabezado con su código). Además:
  - clic en el contador "Estándar" deja solo filas de ese grupo; clic otra vez las restaura;
  - escribir "DEMO-1" en "Buscar lote" deja solo códigos que contienen DEMO-1;
  - clic en otra fila cambia el código en la ficha;
  - mover "Alcohol" en el simulador muestra el texto `La probabilidad (sube|baja)`;
  - "Mandar a cata" con comentario muestra "Listo: el lote quedó como Mandar a cata." y la fila muestra esa decisión;
  - foco en `#umbral` + `ArrowRight` sube el valor 0.05; "Activar umbral 0.55" muestra "Regla activada: Prometedor desde 0.55";
  - escribir `1,500` en `#costo-fp` hace que el costo esperado mostrado sea igual al que devuelve `GET /perilla?costo_falso_premium=1500&costo_bueno_perdido=1500` (Review Focus 1);
  - con el periodo filtrado a un tanque inexistente vía búsqueda "ZZZ", la ficha muestra "Ningún lote cumple con esos filtros" (Review Focus 2);
  - con `page.route("**/perilla**", 500)` la banda muestra "No se pudo calcular la regla." y clic en una fila sigue cambiando la ficha (Review Focus 3);
  - a 900×900, clic en una fila abre `role=dialog` con la ficha y `Escape` lo cierra.
- [ ] **Step 2: Correr la sección `sergio`.** Esperado: FAIL (`#umbral` no existe).
- [ ] **Step 3: Implementar `leerPesos`, `Regla.tsx`, `FichaLote.tsx` y el nuevo `Sergio.tsx`.** Diseño (spec, sección Sergio): banda a todo lo ancho bajo la cabecera, en retícula de 4 columnas en ≥1280 px (costos | umbral y modos | cifras | gráfica + activar), 2 columnas en 1024–1279, 1 bajo 1024. Debajo: fila de contadores-filtro (`role=group` "Filtrar por semáforo", cada uno con `aria-pressed`) y el texto "N sin decisión"; barra de búsqueda, periodo, tanque y "Descargar CSV"; aviso DEMO en una línea con borde izquierdo `ambar`. Cuerpo en ≥1024 px: `grid-cols-[minmax(0,1fr)_420px]`, ficha `sticky top-[cabecera]` con desplazamiento propio. Tabla `role=table` con columnas Lote (marcador + código + DEMO, recortado con `truncate`), Tanque, Fecha, Probabilidad (barra de 120 px + "69 %" alineado a la derecha), Decisión ("Sin decidir" en `suave`); filas de grupo con marcador, nombre y conteo. La fila seleccionada lleva borde izquierdo de 2 px `texto` y `aria-selected`. El lote seleccionado al cargar es el primero (más probable). Se borran `PerillaPanel.tsx` y `Dial.tsx`.
- [ ] **Step 4: Build y secciones `tema` y `sergio`.** Esperado: build limpio; `sergio` PASS; `tema` ya no lista elementos de Sergio.
- [ ] **Step 5: Commit** `web: espacio de trabajo de Sergio con regla, tabla y ficha a la vista`.

### Task 3: Enóloga — captura clara, resultado y pendiente

**Files:**
- Modify: `web/src/vistas/Enologa.tsx`, `docs/prueba_interfaz.py`
- Delete: `web/src/Sello.tsx`

**Interfaces:**
- Consumes: Task 1 primitivos; `SEMAFORO` con `significado` del verde = "Buen candidato para el sello Premium. Avisar a dirección."

- [ ] **Step 1: Agregar la sección `enologa` a la prueba** (390×844, `/?rol=enologa`):
  - "Capturar lote nuevo" abre el formulario; el foco queda en `#codigo`;
  - bajo cada campo de análisis se ve el texto `Normal: <min> – <max>` (con la unidad);
  - en `#codigo` escribir y pulsar `Enter` mueve el foco a `#tanque`; en `#density`, `Enter` lo mueve a `#alcohol`; `Enter` en el último campo envía el formulario;
  - `#chlorides` = 0.25 muestra "Se ve fuera de lo normal";
  - guardar con los 11 valores muestra un número `NN %`, la palabra del semáforo y "Factores principales";
  - con `context.set_offline(True)` una captura muestra "Guardado en tu teléfono" y el inicio lista el pendiente; al volver en línea, "Enviar ahora" lo envía y desaparece;
  - un lote con código de 30 caracteres no provoca desplazamiento horizontal (`scrollWidth <= clientWidth`) a 390 px ni en la tabla de Sergio a 1024 px (Review Focus 5).
- [ ] **Step 2: Correr la sección `enologa`.** Esperado: FAIL en el texto `Normal:`.
- [ ] **Step 3: Implementar.** Inicio: título "Lotes de <nombre>" en 28 px, conteo de hoy, aviso de conexión recto, botón primario de ancho completo, lista con marcador, código, tanque/fecha y "NN %" alineado. Captura: grupos con título de 20 px y línea; `Campo` con etiqueta, ayuda, entrada de 56 px con unidad, y `Normal: a – b unidad` debajo (siempre); aviso fuera de rango en una línea con borde izquierdo `ambar`; `onKeyDown` Enter → siguiente campo del formulario o envío en el último; barra fija recta con "N de 11 análisis" y progreso recto. Resultado: código y tanque, "NN %" en 44 px, `InsigniaSemaforo`, `BarraProbabilidad` con umbral activo, significado, frase, avisos, "Factores principales", botones. Pendiente: sin sello, marcador "pendiente" y el mismo texto actual. Se borra `Sello.tsx`.
- [ ] **Step 4: Build y las tres secciones.** Esperado: todo PASS, incluida la aserción de esquinas sin excepciones.
- [ ] **Step 5: Commit** `web: captura y resultado de la enóloga con el nuevo estilo`.

### Task 4: Documentación, capturas y verificación final

**Files:**
- Modify: `docs/tomar_capturas.py`, `docs/capturas/*.png`, `README.md`, `docs/flujo_usuarios.md`, `HANDOFF.md`

- [ ] **Step 1: Actualizar `docs/tomar_capturas.py`** a los nuevos selectores (sin panel de regla: la banda ya está visible; ficha en columna) y tomar las capturas contra el puerto 8001: `sergio-1-tablero.png` (1440×900, oscuro), `sergio-2-ficha.png` (ficha con simulador), `sergio-3-claro.png` (mismo tablero en tema claro), `enologa-1-inicio.png`, `enologa-2-captura.png`, `enologa-3-resultado.png` (390×844). Borrar las capturas que ya no correspondan.
- [ ] **Step 2: Revisar las capturas a ojo** contra la spec (esquinas, contraste, alineación de cifras, nada escondido) y corregir lo que se vea mal.
- [ ] **Step 3: Actualizar README** (sección de diseño, capturas, nombres nuevos, cómo correr `docs/prueba_interfaz.py`), `docs/flujo_usuarios.md` y la sección 6 de `HANDOFF.md`.
- [ ] **Step 4: Verificación final.** `npm run build` limpio; `npx tsc --noEmit` limpio; `pytest api/tests -q` = 50 passed; `prueba_interfaz.py` completo PASS; `grep -rn "rounded" web/src` sin resultados; base de datos de la carpeta principal sin cambios (fecha de modificación igual a la anterior).
- [ ] **Step 5: Commit** `docs: capturas y textos del rediseño oscuro`.
