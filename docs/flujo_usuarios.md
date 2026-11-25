# Flujo de los usuarios

Dos personas usan VinoScore: **la enóloga**, que captura los análisis de cada lote, y **Sergio**, que decide qué lotes merecen trato premium. Los dos trabajan sobre la misma base de datos.

## La enóloga captura un lote (con y sin conexión)

```mermaid
sequenceDiagram
  autonumber
  actor E as Enóloga
  participant A as App (celular)
  participant L as Memoria del celular<br/>(IndexedDB)
  participant S as Servicio del modelo (API)
  participant B as Base de datos

  E->>A: Escribe código, tanque y los 11 análisis
  A->>A: Avisa en amarillo si un valor está fuera de lo normal
  E->>A: Toca "Guardar y evaluar"

  alt Hay conexión
    A->>S: POST /analisis (1 guarda + 2 pide evaluación)
    S->>B: Guarda lote, análisis y predicción
    S->>S: Corre el modelo, calcula semáforo y 3 razones
    S-->>A: 3 probabilidad, semáforo y razones (y avisos de rango)
    A-->>E: Semáforo grande: Prometedor / Revisar en cata / Estándar
  else No hay conexión
    A->>L: Guarda la captura con un identificador único
    A-->>E: "Guardado en el teléfono: se enviará cuando haya red"
    Note over A,L: Cada 20 segundos, y al volver la red, la app reintenta
    A->>S: POST /analisis (mismo identificador)
    S->>B: Guarda (si ya existía, no se duplica)
    S-->>A: Resultado
    A->>L: Borra la captura pendiente
    A-->>E: El lote aparece en el historial con su semáforo
  end
```

## Sergio decide

```mermaid
sequenceDiagram
  autonumber
  actor G as Sergio
  participant W as Web de Sergio
  participant S as Servicio del modelo (API)
  participant B as Base de datos

  G->>W: Abre el tablero
  W->>S: GET /resumen y GET /lotes
  S->>B: Lee lotes, predicciones y decisiones
  S-->>W: Tarjetas y lotes ordenados por probabilidad
  W-->>G: Cuántos lotes en verde, amarillo y rojo

  G->>W: Abre la ficha de un lote
  W->>S: GET /lotes/{id}
  S-->>W: Análisis, semáforo y 3 razones

  opt ¿Qué pasa si...?
    G->>W: Mueve alcohol, densidad o cloruros
    W->>S: POST /simular (no guarda nada)
    S-->>W: Nueva probabilidad
  end

  G->>W: "Aprobar como Premium", "Mandar a cata" o "Estándar" + comentario
  W->>S: POST /decisiones
  S->>B: Guarda la decisión (quién, cuándo y comentario)
  S-->>W: Confirmación
  W-->>G: La decisión queda en el historial del lote

  opt Perilla del dinero
    G->>W: Escribe cuánto cuesta un falso Premium y un bueno perdido
    W->>S: GET /perilla (costo esperado por umbral)
    S-->>W: Umbral recomendado y "de cada 100 marcados Premium, X sí lo son"
    G->>W: "Activar el umbral"
    W->>S: PUT /configuracion
    S->>B: Guarda el umbral activo
    Note over G,B: El semáforo de todos los lotes se recalcula con la nueva regla
  end
```

## Qué significa cada color

| Semáforo | Palabras | Regla | Qué hacer |
|---|---|---|---|
| Verde | **Prometedor** | Probabilidad ≥ umbral activo | Buen candidato para el sello Premium |
| Amarillo | **Revisar en cata** | Entre 30 % y el umbral activo | Probarlo en cata antes de decidir |
| Rojo | **Estándar** | Menos de 30 % | Se ve como un vino estándar |

El umbral activo empieza en 0.5 y Sergio lo cambia con la perilla del dinero.
