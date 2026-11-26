# Rediseño "herramienta": oscuro, sobrio y sin esquinas redondas

Aprobado por el dueño el 2026-11-25.

## Intención

El rediseño anterior (sello dentado, perilla giratoria, titular serif grande sobre azul marino) "se ve hecho por una IA". El dueño quiere que VinoScore se sienta como una **herramienta profesional**: elegante, minimalista y fácil de seguir, sin esconder ninguna función. Inspiración general: los sitios de awwwards.com (retícula estricta, bordes rectos, una sola familia tipográfica, casi monocromo).

## Metas

- Modo oscuro como función, **activo por defecto**, con interruptor a claro que se recuerda en el navegador.
- Paleta simple: monocroma; el color solo significa datos (semáforo).
- **Ninguna esquina redonda** en cajas, paneles, tablas, campos ni botones. Los marcadores de semáforo son cuadrados pequeños.
- Datos fáciles de capturar y de leer: cifras alineadas (tabular), rangos normales siempre visibles al capturar, Enter pasa al siguiente campo.
- Tono profesional en los textos (español de México, sin jerga, sin frases de vendedor).
- Todas las funciones actuales siguen disponibles y visibles.

## No metas

- No cambia la API, la base de datos, el modelo ni las reglas del semáforo.
- No se agregan funciones nuevas.
- No se publica nada (sin push) hasta que el dueño lo pida.

## Enfoques considerados

- **A. Espacio de trabajo con todo a la vista (elegido).** Sergio ve en una sola pantalla: la regla de decisión (umbral, modos rápidos, costos, cifras y gráfica de costo), la tabla de lotes y la ficha del lote seleccionado en una columna fija a la derecha. Nada queda detrás de un clic.
- B. Misma estructura actual (paneles laterales que se deslizan) solo con nuevo estilo. Menos trabajo, pero sigue escondiendo la ficha y la regla.

El dueño no eligió explícitamente; se tomó A porque pidió "no esconder ninguna función" y aprobó la propuesta que lo indicaba.

## Decisiones de diseño

### Color (tokens)

| Token | Oscuro (por defecto) | Claro |
|---|---|---|
| fondo | `#141516` | `#F7F7F5` |
| superficie | `#1C1D1F` | `#FFFFFF` |
| línea | `#2E3033` | `#DADAD7` |
| texto | `#ECECEA` | `#17181A` |
| suave | `#9C9EA1` | `#5E6064` |
| primario (botón) | `#ECECEA` sobre texto `#141516` | `#17181A` sobre texto blanco |
| verde / ámbar / rojo | `#6CBF78` / `#E3B341` / `#E8685A` | `#2F7A3B` / `#8A6100` / `#B3372B` |

Sin color de marca, sin sombras, sin degradados.

### Tipografía

Una sola familia: **IBM Plex Sans** (empaquetada con la app, funciona sin conexión). Cifras con `tabular-nums`. Escala: 12 / 14 / 16 / 20 / 28 / 44. Títulos en peso 500, nunca en mayúsculas espaciadas.

### Sergio (escritorio)

```
VinoScore                                        Tema ◐   Sergio ▾
Regla de decisión
  Umbral [──────●─────] 0.50   Filtro a cata 0.30 | Sello Premium 0.60 | Más barato 0.25
  Costos: falso Premium $500, bueno perdido $1,500   Marcados 33.8 | Falsos 17.5 | Perdidos 4.5
  Costo esperado $15,572 por 100 lotes            [gráfica de barras por umbral]   [Activar 0.25]
───────────────────────────────────────────────────────────────────
■ 6 Prometedor  ■ 1 Revisar en cata  ■ 3 Estándar  10 Todos   7 sin decisión
Buscar | Últimos 7 días | Tanque | Descargar CSV
Lote       Tanque  Fecha          Probabilidad        Decisión  │ Ficha del lote seleccionado
■ DEMO-16  T-04    ayer 05:03     ████──│── 69 %      Premium   │ 69 %  Prometedor, razones,
...                                                             │ simulador, análisis, historial,
                                                                │ comentario y decisión
```

- La tabla conserva la agrupación por semáforo (filas de encabezado de grupo) y la marca DEMO.
- Al abrir, la ficha muestra el lote más prometedor (sustituye al sello "Lote más prometedor").
- En pantallas menores a 1024 px la ficha se abre como panel encima (el componente `Panel` actual), y la regla queda arriba en una sola columna.
- La perilla giratoria se sustituye por un control deslizante (0.05 a 0.95, paso 0.05) con teclado, más los botones de modos rápidos y la marca de "más barato".

### Enóloga (celular)

- Inicio: botón principal "Capturar lote nuevo", aviso de conexión o pendientes, lista de lotes recientes con probabilidad alineada.
- Captura: grupos actuales; cada campo con etiqueta, ayuda, unidad y "Normal: a – b" siempre visible; aviso si queda fuera; Enter pasa al siguiente campo y en el último guarda; barra fija con progreso y "Guardar y evaluar".
- Resultado: "69 %" grande, palabra del semáforo con su marcador, barra con umbral, frase, razones y botones.
- Pendiente (sin conexión): mismo esquema, sin sello.

### Textos

"La perilla del dinero" → "Regla de decisión"; "Gira hasta la regla que quieras" → "Umbral"; "Avísale a Sergio" → "Avisar a dirección"; "Libro de lotes" → "Lotes"; "¿Qué pasa si…?" → "Simulador"; "Lo que más pesó" → "Factores principales". Las palabras del semáforo no cambian.

### Calidad

Foco visible en todo, contraste AA en ambos temas, `prefers-reduced-motion` respetado, sin desbordes a 390 px, PWA con `theme-color` oscuro.

## Lo que queda al constructor

Medidas exactas, orden de columnas en pantallas medianas, tratamiento de la gráfica dentro de la banda, actualización de `docs/tomar_capturas.py`, capturas del README y textos de documentación.
