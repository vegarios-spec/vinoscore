# Arquitectura de VinoScore

VinoScore tiene tres piezas que se hablan entre sí:

| Pieza | Qué hace | Quién la usa |
|---|---|---|
| **App de la enóloga** | Captura los 11 análisis de cada lote y muestra el resultado al instante | La enóloga, desde el celular |
| **Servicio del modelo (API)** | Corre el modelo, calcula el semáforo y las razones, y guarda todo | Las dos apps |
| **Base de datos** | Guarda lotes, análisis, predicciones, decisiones y la configuración | La API |
| **Web de Sergio** | Regla de decisión, lotes, ficha, decisiones y simulador | Sergio, desde la computadora |

Los **cuatro pasos** del flujo son los mismos en las dos versiones:

1. **Guarda:** la enóloga captura el análisis y se guarda en la base de datos.
2. **Pide evaluación:** la app le pide al servicio del modelo que lo evalúe.
3. **Probabilidad y semáforo:** el servicio responde con la probabilidad, el semáforo y las 3 razones.
4. **Consulta y decide:** Sergio ve los lotes y decide: Premium, Mandar a cata o Estándar.

![Arquitectura de VinoScore: prototipo y versión objetivo](arquitectura.png)

> Versión vectorial: [`arquitectura.svg`](arquitectura.svg). El código fuente del diagrama está en [`diagramas/arquitectura.mmd`](diagramas/arquitectura.mmd).

## Versión del prototipo (lo que existe hoy)

Todo corre en una sola computadora, con una base SQLite. En el prototipo la app hace **un solo envío** (`POST /analisis`) que cubre los pasos 1 y 2: la API guarda el análisis, corre el modelo y devuelve el resultado (paso 3).

```mermaid
flowchart TB
  PE["<b>App de la enóloga</b><br/>web instalable en el celular<br/>guarda sin conexión"]
  PS["<b>Web de Sergio</b><br/>escritorio"]
  PA["<b>Servicio del modelo</b><br/>API FastAPI + Random Forest"]
  PD[("<b>Base de datos</b><br/>SQLite local")]
  PE -- "<b>1 guarda el análisis</b><br/><b>2 pide evaluación</b><br/>(un solo envío)" --> PA
  PA -- "<b>3 probabilidad,<br/>semáforo y razones</b>" --> PE
  PS -- "<b>4 consulta y decide</b>" --> PA
  PA <-- "guarda y lee" --> PD

  classDef app fill:#ffffff,stroke:#0F7C7A,stroke-width:3px,color:#1B3A57
  classDef api fill:#1B3A57,stroke:#1B3A57,color:#ffffff
  classDef bd fill:#FBF1DD,stroke:#E09F3E,stroke-width:3px,color:#1B3A57
  class PE,PS app
  class PA api
  class PD bd
```

Para pasar a PostgreSQL basta con cambiar la variable `DATABASE_URL`: la API usa SQLAlchemy y no depende de SQLite.

## Versión objetivo (producción)

La app móvil nativa guarda en la base de datos en la nube (paso 1) y pide la evaluación al servicio del modelo (paso 2). Sergio consulta la misma base de datos desde la web (paso 4).

```mermaid
flowchart TB
  OE["<b>App móvil nativa de la enóloga</b><br/>Expo / React Native<br/>sin conexión completo + cámara"]
  OS["<b>Web de Sergio</b><br/>Vercel o Netlify<br/>dominio + HTTPS"]
  OA["<b>Servicio del modelo</b><br/>API en Render, Railway o Fly.io"]
  OD[("<b>Base de datos en la nube</b><br/>PostgreSQL (Supabase)<br/>usuarios, roles y respaldos diarios")]
  OM["Monitoreo de errores<br/>(Sentry)"]
  OE -- "<b>1 guarda el análisis</b>" --> OD
  OE -- "<b>2 pide evaluación</b>" --> OA
  OA -- "<b>3 probabilidad<br/>y semáforo</b>" --> OE
  OA <-- "lee y guarda<br/>el resultado" --> OD
  OS -- "<b>4 consulta y decide</b>" --> OD
  OS -. "regla y simulador" .-> OA
  OA -.-> OM

  classDef app fill:#ffffff,stroke:#0F7C7A,stroke-width:3px,color:#1B3A57
  classDef api fill:#1B3A57,stroke:#1B3A57,color:#ffffff
  classDef bd fill:#FBF1DD,stroke:#E09F3E,stroke-width:3px,color:#1B3A57
  classDef aux fill:#F4F6F8,stroke:#9AA9B8,stroke-dasharray:4 3,color:#4A5A6A
  class OE,OS app
  class OA api
  class OD bd
  class OM aux
```

Los pasos para llegar ahí están en [`ruta_a_produccion.md`](ruta_a_produccion.md).

## Cómo volver a exportar el diagrama

El diagrama se exporta con [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) (necesita Node.js y un navegador Chromium):

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagramas/arquitectura.mmd -o docs/arquitectura.svg -b "#F4F6F8"
npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagramas/arquitectura.mmd -o docs/arquitectura.png -b "#F4F6F8" -s 2
```

Si `mmdc` no encuentra un navegador, instala Chromium o indícale uno con `-p puppeteer-config.json` (un archivo con `{"executablePath": "<ruta a chrome>"}`).
