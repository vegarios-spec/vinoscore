# VinoScore

**VinoScore estima si un caldo de vino blanco es *prometedor*** (calidad sensorial de 7 o más, en una escala de 0 a 10) a partir de 11 análisis de laboratorio.

Es el prototipo de un proyecto universitario del Tec de Monterrey para un socio formador, **Sergio García**, contador que dirige una bodega. Lo usan dos personas sobre una sola base de datos:

- **La enóloga** captura los análisis de cada lote desde el celular y ve de inmediato si el lote se ve prometedor.
- **Sergio** decide desde la computadora qué lotes merecen trato premium y ajusta la regla según lo que le cuesta equivocarse.

> ⚠️ **Es un prototipo.** El modelo se entrenó con vinos blancos terminados (tipo Vinho Verde), no con datos de la bodega. Sirve para mostrar cómo funcionaría la herramienta; no debe usarse todavía para decisiones reales. Mira las [limitaciones](#limitaciones).

---

## Cómo se ve

Cada persona tiene **una sola pantalla de trabajo, sin pestañas**. Lo demás se abre encima y se cierra con la X o con Esc.

El estilo es sobrio: azul noche y papel, un latón apagado en los detalles, títulos en serif ligera (Newsreader) y texto en Inter.

La firma visual de VinoScore es el **sello**: cada lote recibe uno que se estampa con su resultado (Prometedor, Revisar en cata o Estándar) y cuántos de cada 100 lotes así resultan buenos. El semáforo siempre lleva texto, nunca solo color.

### La enóloga (celular)

Inicio con un botón grande para capturar y sus lotes recientes. La captura va por grupos (lo básico, acidez, azúcar y sulfatos, azufre) con una barra de avance fija. El resultado ocupa toda la pantalla.

<table>
  <tr>
    <td align="center"><img src="docs/capturas/enologa-1-inicio.png" width="240" alt="Inicio: botón para capturar y lotes recientes"><br><sub><b>Inicio:</b> capturar y ver sus lotes</sub></td>
    <td align="center"><img src="docs/capturas/enologa-2-captura.png" width="240" alt="Captura con aviso de valor fuera de lo normal"><br><sub><b>Captura:</b> avisa si un valor se ve raro</sub></td>
    <td align="center"><img src="docs/capturas/enologa-3-resultado.png" width="240" alt="Resultado con sello"><br><sub><b>Resultado:</b> el sello y por qué salió así</sub></td>
  </tr>
</table>

### Sergio (computadora)

El encabezado resume la semana, y sus contadores de colores **son también los filtros**. Abajo, el libro de lotes agrupado por semáforo. Un lote abre su ficha en un panel lateral (con decisión y simulador); la regla activa de la barra superior abre la perilla.

![Tablero de Sergio](docs/capturas/sergio-1-tablero.png)

| | |
|---|---|
| ![Ficha del lote](docs/capturas/sergio-2-ficha.png)<br>**Ficha del lote:** sello, razones y decisión | ![Simulador](docs/capturas/sergio-3-simulador.png)<br>**¿Qué pasa si…?** Dentro de la ficha: mover alcohol, densidad o cloruros |

![La perilla del dinero](docs/capturas/sergio-4-perilla.png)

**La perilla del dinero** es una perilla de verdad: se gira con el ratón, con el dedo o con las flechas del teclado. Muestra qué pasaría con cada regla y marca la más barata con un rombo ámbar.

*Los lotes `DEMO-xx` son datos de demostración: vinos reales del conjunto de pruebas del modelo, no lotes de la bodega.*

---

## Cómo correrlo

Se probó en Windows 11 con Python 3.14 y Node.js 26. Necesitas **Python 3.11 o superior** y, para la web, **Node.js 20 o superior**.

### Un solo comando

**Windows (PowerShell):**
```powershell
.\iniciar.ps1
```

**Mac o Linux:**
```bash
./iniciar.sh
```

El script crea el entorno de Python, instala lo necesario, compila la web, carga los 30 lotes de demostración y abre el navegador en <http://localhost:8000>:

| Quién | Dirección |
|---|---|
| Enóloga | <http://localhost:8000> |
| Sergio | <http://localhost:8000/?rol=sergio> (o, desde el menú de perfil de la esquina, "Sergio") |
| Documentación de la API | <http://localhost:8000/docs> |

Opciones: `.\iniciar.ps1 -SinDemo` (sin datos de demostración), `-Puerto 9000`, `-Reconstruir` (volver a compilar la web). En Mac/Linux: `SIN_DEMO=1`, `PUERTO=9000`, `RECONSTRUIR=1`.

### Otras formas

| Forma | Comando | Estado |
|---|---|---|
| Docker | `docker compose up --build` | ⚠️ Incluido, **sin probar** (la máquina de desarrollo no tenía Docker) |
| Make | `make iniciar` | ⚠️ Incluido, **sin probar** (la máquina de desarrollo no tenía `make`) |
| Modo desarrollo | `uvicorn api.main:app --reload` y, en otra terminal, `cd web && npm run dev` (<http://localhost:5173>) | Probado |

### Probarlo desde el celular

Con el servidor corriendo, abre `http://<IP de tu computadora>:8000` en el celular conectado a la misma red wifi. **Para instalarlo como app (PWA) hace falta HTTPS**; en pruebas locales solo funciona en `localhost`. Con `http://` por la red local la captura y el modo sin conexión funcionan, pero el navegador no ofrece "Instalar". En producción, el hosting da HTTPS automáticamente.

### Pruebas

```bash
.venv/Scripts/python -m pytest api/tests -q     # Windows
.venv/bin/python -m pytest api/tests -q         # Mac / Linux
```

50 pruebas: predicción y semáforo, razones, perilla del dinero, validación de datos y los endpoints. Usan una base de datos temporal, nunca la real.

### Reentrenar el modelo

```bash
python modelo/entrenar.py
```

Reproduce el modelo del equipo y vuelve a escribir `modelo/vinoscore_rf.joblib` y `modelo/metricas.json`. Si las métricas se alejan más de ±0.02 de las del equipo, el script se detiene y no guarda nada.

---

## Cómo funciona

1. La enóloga captura los 11 análisis de un lote.
2. El **modelo** (un Random Forest de 150 árboles) estima la **probabilidad** de que el vino sea de calidad 7 o más.
3. La probabilidad se convierte en un **semáforo**, siempre con texto (no solo color):

| Semáforo | Palabras | Cuándo |
|---|---|---|
| 🟢 Verde | **Prometedor** | probabilidad ≥ umbral activo (empieza en 0.5) |
| 🟡 Amarillo | **Revisar en cata** | entre 0.3 y el umbral activo |
| 🔴 Rojo | **Estándar** | menos de 0.3 |

4. Se muestran **3 razones** en lenguaje simple, por ejemplo: *"Alcohol alto (12.6 %): favorece la calidad"*.
5. Sergio ve todos los lotes, decide (**Premium**, **Mandar a cata** o **Estándar**) y puede cambiar el umbral con la perilla del dinero.

> **Sobre las razones:** son una explicación **aproximada**. Se eligen las 3 variables con más peso en las que el lote más se aleja de la mediana de los vinos buenos, y se dice si ese valor favorece o resta. No es un desglose exacto de lo que calculó el modelo.

### La perilla del dinero

Sergio escribe dos costos, en pesos por lote:

- ¿Cuánto le cuesta etiquetar Premium un vino que no lo es? (**falso Premium**)
- ¿Cuánto pierde si un vino bueno se vende como estándar? (**bueno perdido**)

Con eso, VinoScore calcula el costo esperado de cada umbral (de 0.05 a 0.95) y recomienda el más barato:

```
costo = (falsos Premium × costo de un falso Premium) + (buenos perdidos × costo de un bueno perdido)
```

Se calcula con los 1,188 vinos de prueba del modelo y se muestra por cada 100 lotes. También incluye dos modos rápidos: **Sello Premium** (umbral 0.6) y **Filtro a cata** (umbral 0.3). Los costos iniciales ($500 y $1,500) son **de ejemplo**.

---

## Qué tan bien funciona el modelo

El modelo se evaluó con 1,188 vinos que no vio al entrenar (247 de ellos buenos). Esto significa para el negocio:

| Medida | Resultado | Qué significa para tu lote |
|---|---|---|
| **Aciertos** (accuracy) | 83 % | De cada 100 lotes, el modelo clasifica bien unos 83. Ojo: como solo 21 de cada 100 vinos son buenos, decir "estándar" siempre acertaría 79. El modelo mejora eso, pero no tanto como parece. |
| **Precisión** | 65 % | De cada 100 lotes marcados *Prometedor*, unos 65 sí son buenos y 35 no (falsos Premium). |
| **Recall** (cobertura) | 38 % con el umbral 0.5 | De cada 100 vinos buenos, el modelo marca *Prometedor* a unos 38. El resto se va como estándar o amarillo. |
| **AUC** | 0.84 | Si tomas un vino bueno y uno que no lo es, el bueno recibe una probabilidad más alta 84 de cada 100 veces. |

**El umbral cambia el trato entre aciertos y vinos perdidos** (con los 1,188 vinos de prueba):

| Regla | Lotes marcados | De cada 100 marcados, sí son buenos | De cada 100 buenos, los encuentra |
|---|---|---|---|
| **Filtro a cata** (≥ 0.30) | 30 de cada 100 | 50 | 72 |
| Regla inicial (≥ 0.50) | 13 de cada 100 | 65 | 40 |
| **Sello Premium** (≥ 0.60) | 7 de cada 100 | 68 | 24 |

Las variables que más pesan en el modelo son **alcohol** (17 %), **densidad** (12 %) y **cloruros** (9 %), por eso el simulador deja moverlas.

<details>
<summary>Cifras técnicas y diferencia con las del equipo</summary>

Con la receta del equipo (`good = quality ≥ 7`, 11 variables sin escalar, `train_test_split(test_size=0.3, stratify=y, random_state=42)`, `RandomForestClassifier(n_estimators=150, random_state=42)`) el resultado es:

| Métrica (prueba, umbral 0.5) | Este repositorio | Equipo |
|---|---|---|
| Accuracy | 0.827 | 0.831 |
| Precisión (bueno) | 0.646 | 0.655 |
| Recall (bueno) | 0.377 | 0.393 |
| F1 | 0.476 | 0.491 |
| AUC | 0.843 | 0.846 |

La diferencia es de unos 4 vinos de 247 y cae dentro del ruido normal de un Random Forest: con otras 10 semillas, el recall va de 0.377 a 0.401. Lo más probable es que venga de la versión de scikit-learn (aquí, la 1.9.1). Se usan las cifras de este repositorio.

En la tabla de umbrales, el umbral 0.50 da precisión 0.653 y recall 0.397, un poco distinto de lo anterior: allí se aplica la misma regla que el semáforo (probabilidad *mayor o igual* al umbral), y 5 vinos tienen exactamente 0.50, mientras que `predict()` los clasifica como no buenos.
</details>

---

## Estructura del proyecto

```
vinoscore/
├─ data/vino_limpio.csv         3,960 vinos blancos limpios
├─ modelo/
│  ├─ entrenar.py               entrena y verifica el modelo
│  ├─ vinoscore_rf.joblib       modelo entrenado (7.6 MB)
│  └─ metricas.json             métricas, umbrales, rangos normales y medianas
├─ api/                         FastAPI + SQLAlchemy (SQLite)
│  ├─ main.py                   endpoints
│  ├─ servicio_modelo.py        probabilidad, semáforo, razones y avisos
│  ├─ perilla.py                costo esperado por umbral
│  ├─ sembrar_demo.py           lotes DEMO-01…DEMO-30
│  └─ tests/                    pruebas con pytest
├─ web/                         React + Vite + TypeScript + Tailwind (PWA)
├─ docs/                        arquitectura, flujo de usuarios y ruta a producción
├─ iniciar.ps1 / iniciar.sh     un solo comando
└─ Dockerfile, docker-compose.yml, Makefile
```

### Endpoints principales

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/analisis` | Guarda el análisis, corre el modelo y devuelve probabilidad, semáforo y 3 razones |
| `GET` | `/lotes` | Lista los lotes por probabilidad (filtros: `desde`, `hasta`, `tanque`, `semaforo`) |
| `GET` | `/lotes/{id}` | Ficha del lote |
| `POST` | `/decisiones` | Premium / Mandar a cata / Estándar, con comentario |
| `GET` `PUT` | `/configuracion` | Umbral activo y los dos costos |
| `GET` | `/perilla` | Costo esperado por umbral y recomendación |
| `POST` | `/simular` | Nueva probabilidad con valores modificados, sin guardar nada |
| `GET` | `/exportar.csv` | Lotes y decisiones para Excel |

Si un valor queda fuera del rango normal (percentiles 1 y 99 de los datos), se **guarda de todos modos** y se manda una advertencia. La documentación completa está en `/docs`.

### Pasar a PostgreSQL

La API usa SQLAlchemy, así que basta con cambiar la variable de entorno (ver `.env.example`) e instalar el controlador:

```
DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/vinoscore
```

Más detalles en [`docs/ruta_a_produccion.md`](docs/ruta_a_produccion.md).

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md): diagrama de la arquitectura del prototipo y de la versión objetivo.
- [`docs/flujo_usuarios.md`](docs/flujo_usuarios.md): qué hacen la enóloga y Sergio, paso a paso.
- [`docs/ruta_a_produccion.md`](docs/ruta_a_produccion.md): qué falta para una aplicación completa y qué hay que conseguir.

---

## Limitaciones

Lee esto antes de confiar en un resultado:

- **El modelo no conoce tu bodega.** Se entrenó con vino blanco *terminado* tipo Vinho Verde. Falta validarlo con **caldos en proceso** y con **datos propios de la bodega**; podría equivocarse mucho con otras uvas, regiones o etapas.
- **Los análisis de la bodega pueden no coincidir.** Si el laboratorio no mide alguna de las 11 variables, o las mide con otro método o unidades, hay que reentrenar.
- **Encuentra pocos vinos buenos con la regla inicial** (recall de 38 %). Para no perder candidatos conviene el modo *Filtro a cata*, a costa de catar más.
- **Las probabilidades no están calibradas.** "71 de cada 100" es una estimación del modelo; no se ha comprobado que 71 de cada 100 lotes así resulten buenos en la realidad.
- **Las razones son aproximadas** (ver arriba).
- **La perilla usa los vinos de prueba del modelo**, donde 21 de cada 100 son buenos. En la bodega esa proporción puede ser distinta, y entonces el umbral óptimo también.
- **Es un prototipo:** no hay inicio de sesión (el rol se elige con un botón), la base de datos es un archivo SQLite de un solo usuario, y el modo sin conexión es básico (guarda y reenvía capturas; no guarda las fichas para consultarlas sin red).
- **"Calidad ≥ 7" es el criterio del equipo**, no necesariamente el de Sergio.
- El **orden de captura** de los análisis es una propuesta, por confirmar con la enóloga.

## Créditos

Proyecto del Tec de Monterrey para el socio formador **Sergio García**.

| Integrante | Aportó |
|---|---|
| **Elias Vega Rios** | Modelo de datos |
| **Francisco Romero de la Parra** | Arquitectura y gestión |
| **Diego García Serrano** | UX/UI y comunicación |

Datos: vino blanco tipo Vinho Verde, limpiado por el equipo (`data/vino_limpio.csv`). Parece provenir del conjunto público *Wine Quality* del repositorio UCI; confirmar la fuente antes de citarla.
