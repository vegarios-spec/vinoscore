# Ruta a producción

Lo que falta para pasar de este prototipo a una aplicación completa, y lo que el equipo tiene que conseguir para lograrlo.

> **Regla de este documento:** no se inventan datos de la bodega. Donde falta información hay una pregunta marcada con ❓, y las fechas están como **POR CONFIRMAR**.

## Dónde estamos hoy

| Ya funciona en el prototipo | Es de mentira o limitado |
|---|---|
| Modelo Random Forest, semáforo y 3 razones | El modelo no ha visto datos de la bodega |
| Captura móvil con avisos de rango, historial y modo sin conexión básico | Sin inicio de sesión: el rol se elige con un botón |
| Tablero, ficha, decisiones, perilla del dinero, simulador y CSV | Base de datos SQLite local, de un solo usuario |
| Tablas `lotes`, `analisis`, `predicciones`, `decisiones` y `configuracion` | Los costos de la perilla ($500 y $1,500) son de ejemplo |
| 50 pruebas automáticas | Todo corre en una computadora; nada está publicado |

---

## Parte 1. Lo que falta construir

Tamaño relativo: **S** = pocos días, **M** = una a dos semanas, **L** = más de dos semanas. Son estimaciones del orden de magnitud para planear, no compromisos.

### 1. Base de datos en la nube compartida · M

- Migrar de SQLite a **PostgreSQL en Supabase**. La API ya usa SQLAlchemy: se cambia `DATABASE_URL` y se agrega el controlador (`psycopg`).
- **Migraciones con Alembic**, para que cada cambio de tablas quede versionado (hoy las tablas se crean solas al arrancar, lo cual no sirve cuando ya hay datos reales).
- **Respaldos diarios** (Supabase los ofrece según el plan: confirmar qué incluye el plan elegido).
- **Reglas de acceso por fila** (Row Level Security): la enóloga solo ve sus lotes; Sergio ve todo.
- **¿Supabase o Firebase?** Recomendación: **Supabase**. Los datos son relacionales (lotes → análisis → predicciones → decisiones) y la API ya usa SQL. Firebase es una base de documentos: obligaría a rehacer las consultas y las reglas. Decisión del equipo: **POR CONFIRMAR**.

### 2. Usuarios y permisos · M

Inicio de sesión real con roles:

| Rol | Puede |
|---|---|
| **Enóloga** | Capturar lotes y ver sus propios lotes y resultados |
| **Sergio (dueño)** | Ver todo, decidir y cambiar la perilla del dinero |
| **Administrador** | Gestionar usuarios y roles |

Opción natural: Supabase Auth (correo y contraseña o enlace mágico) y que la API valide el token (JWT) en cada petición. Hoy `capturado_por` y `quien` son texto libre; pasarían a ser el usuario autenticado.

### 3. App móvil nativa · L

Con **Expo (React Native)**:

- **Modo sin conexión completo:** guardar en el teléfono (`expo-sqlite`), ver lotes anteriores sin red y sincronizar con resolución de conflictos. El prototipo solo guarda y reenvía capturas.
- **Cámara** para fotografiar el reporte del laboratorio (primera versión: adjuntar la foto al lote; después, extraer los valores automáticamente, con revisión de la enóloga antes de guardar).
- **Notificaciones** cuando un lote salga en verde (`expo-notifications`).
- Compilación con EAS. Si se publica en tiendas hacen falta cuentas de desarrollador (ver Parte 2).

La vista actual de la enóloga (la PWA) sirve como referencia de pantallas y textos.

### 4. Publicación · M

- **API:** Render, Railway o Fly.io. Se empaqueta con el `Dockerfile` que ya está en el repositorio (sin probar todavía).
- **Web de Sergio:** Vercel o Netlify (la carpeta `web/` es una aplicación Vite estándar).
- **Dominio, HTTPS y CORS:** la variable `CORS_ORIGINS` debe llevar la URL real de la web. HTTPS es obligatorio para instalar la PWA.
- Variables secretas en el panel del hosting, nunca en el repositorio.

### 5. Modelo con datos de la bodega · L

El paso más importante para que el resultado sea confiable.

1. **Ajustar las variables** a lo que realmente mide el laboratorio de Sergio. Si falta alguna de las 11, se reentrena sin ella.
2. **Reentrenar con su historial** de lotes con calificación de cata (idealmente cientos). Mientras haya pocos lotes, el modelo del prototipo puede servir de punto de partida, pero no de sustituto.
3. **Versionar el modelo:** la tabla `predicciones` ya guarda `version_modelo`. Falta un registro de versiones (qué datos, qué métricas, quién lo aprobó).
4. **Comparar contra el actual** antes de cambiarlo (mismos lotes de prueba, mismas métricas).
5. **Calibración:** revisar que "70 %" signifique que ~70 de cada 100 lotes así salen buenos (curva de calibración y puntaje de Brier; si hace falta, `CalibratedClassifierCV`). Las razones también deberían pasar de aproximadas a **valores SHAP**.
6. **Revisar la perilla:** hoy usa la proporción de buenos del conjunto de prueba (21 %); con datos de la bodega se recalcula con su proporción real.

*Opción futura (solo si hiciera falta):* si algún día se necesitara correr el modelo dentro de la app o con mucho volumen, se puede exportar a ONNX y servir desde un lenguaje más rápido (por ejemplo, Rust). Con unos cuantos lotes a la semana no hace falta.

### 6. Ciclo de aprendizaje · M

- Nueva tabla `catas`: lote, calificación de la cata, catador, fecha, comentario.
- Cada mes, comparar lo que predijo el modelo contra el resultado real de la cata: aciertos, falsos Premium, buenos perdidos.
- Reentrenar con los lotes nuevos cuando haya suficientes y publicar la nueva versión solo si mejora.
- Pantalla para que la enóloga o Sergio registren la cata del lote.

### 7. Reportes para Sergio · M

Un **reporte mensual en PDF y Excel** con el impacto en pesos de las decisiones: lotes evaluados, cuántos se aprobaron como Premium, cuántos resultaron buenos en la cata y el costo de los falsos Premium y de los buenos perdidos (con la perilla real). Hoy ya existe el CSV de lotes y decisiones (`/exportar.csv`); los reportes se construyen sobre él. ❓ El formato exacto lo define Sergio (ver Parte 2).

### 8. Calidad y seguridad · M

- **Pruebas de punta a punta** (Playwright) sobre el flujo completo, además de las 50 pruebas actuales de la API.
- **Monitoreo de errores:** Sentry (opcional, ver Parte 2).
- **Bitácora de cambios:** quién cambió qué y cuándo (decisiones, perilla, usuarios). Hoy solo se guarda quién decidió.
- **Datos personales y LFPDPPP:** los datos de las personas (nombre y correo de los usuarios) se rigen por la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Hace falta un **aviso de privacidad** y guardar solo lo necesario. Revisarlo con alguien que conozca la ley; este documento no es asesoría legal.
- Límite de peticiones, respaldo verificado (probar restaurarlo) y revisión de dependencias.

---

## Parte 2. Lo que Elias tiene que cargar o conseguir

Lista de verificación. Cada punto dice **para qué sirve** y **dónde se pone**.

### A. Información de la bodega (preguntar a Sergio)

- [ ] **Qué análisis mide su laboratorio, con qué unidades y en qué etapa** (mosto, fermentación o vino terminado).
  - *Sirve para:* saber si las 11 variables del modelo existen en su bodega. Si no mide alguna, hay que reentrenar sin ella; si mide en otra etapa, el modelo actual no aplica igual.
  - *Se pone en:* `api/variables.py` (nombres, unidades y orden del formulario) y el reentrenamiento (`modelo/entrenar.py`).
  - ❓ ¿Mide acidez fija, acidez volátil, ácido cítrico, azúcar residual, cloruros, SO₂ libre, SO₂ total, densidad, pH, sulfatos y alcohol? ¿En qué unidades y en qué etapa?
- [ ] **El historial de lotes:** los análisis y la **calificación de cata** de cada lote, idealmente cientos, en Excel o CSV.
  - *Sirve para:* reentrenar el modelo con datos de la bodega y medir cuánto acierta.
  - *Se pone en:* `data/` (por ejemplo `data/lotes_bodega.csv`; **no se sube al repositorio** si tiene datos sensibles: agregarlo a `.gitignore`) y se carga a la tabla `analisis` / `catas`.
  - ❓ ¿Cuántos lotes existen? ¿Cómo se calificó cada uno (escala, quién, cuándo)?
- [ ] **Qué considera él "prometedor".**
  - *Sirve para:* definir la variable que el modelo aprende (`good`). Hoy es "calidad ≥ 7".
  - *Se pone en:* `modelo/entrenar.py` (la línea `good = quality >= 7`).
  - ❓ ¿Calidad de 7 o más, o su propio criterio (por ejemplo, un puntaje de cata propio, un premio, un precio)?
- [ ] **Su catálogo de tanques y barricas, y cómo nombra los lotes.**
  - *Sirve para:* que el formulario sugiera tanques en lugar de texto libre y valide el código del lote.
  - *Se pone en:* una tabla `tanques` en la base de datos y el formato del código en el formulario.
  - ❓ ¿Cuántos tanques y barricas hay y cómo se llaman? ¿Cómo se forma el código de un lote?
- [ ] **Los dos costos de la perilla,** en pesos por lote o por botella.
  - *Sirve para:* que la recomendación de umbral refleje su dinero real. Hoy usa $500 y $1,500 de ejemplo.
  - *Se pone en:* pantalla "Perilla del dinero" (se guardan en la tabla `configuracion`). Valores iniciales: `COSTO_FALSO_PREMIUM_INICIAL` y `COSTO_BUENO_PERDIDO_INICIAL` en `.env`.
  - ❓ ¿Cuánto le cuesta un falso Premium? ¿Cuánto pierde por un bueno vendido como estándar? ¿Por lote o por botella (y cuántas botellas tiene un lote)?
- [ ] **Quién captura, cuándo y con qué dispositivo, y si hay internet en la bodega.**
  - *Sirve para:* decidir qué tan completo debe ser el modo sin conexión y si basta una PWA o hace falta la app nativa.
  - *Se pone en:* decisiones de diseño (no es un archivo).
  - ❓ ¿Quién captura? ¿En qué momento del proceso? ¿Celular Android o iPhone? ¿Hay wifi o datos móviles junto a los tanques?
- [ ] **Cómo quiere ver los resultados y qué reportes necesita para su contabilidad.**
  - *Sirve para:* diseñar el reporte mensual en PDF y Excel (columnas, periodos, formato).
  - *Se pone en:* el módulo de reportes (Parte 1, punto 7).
  - ❓ ¿Qué columnas necesita? ¿Cada cuánto? ¿Tiene un formato de Excel que ya use?
- [ ] **Nombres y correos de los usuarios** (enóloga, Sergio y otros) **y su rol.**
  - *Sirve para:* crear las cuentas con inicio de sesión real.
  - *Se pone en:* Supabase Auth (tabla de usuarios y roles). **No** va en el repositorio.
  - ❓ ¿Quiénes son, con qué correo y qué rol tiene cada uno?

### B. Cuentas y credenciales

> **Van solo en el archivo `.env` (en tu computadora) o en los secretos del hosting. Nunca en el repositorio.** El repositorio incluye `.env.example` con los nombres de las variables y sin valores.

| Qué | Para qué sirve | Dónde se pone |
|---|---|---|
| **GitHub:** tu usuario y el acceso del equipo al repositorio | Guardar el código y trabajar en equipo | Configuración del repositorio (Settings → Collaborators) |
| **Supabase:** `SUPABASE_URL` y `SUPABASE_ANON_KEY` | Conectar la app y la web a la base de datos y al inicio de sesión | `.env` y secretos del hosting. La clave *anon* puede ir en la web y la app (protegida con reglas por fila) |
| **Supabase:** `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de administrador, saltándose las reglas por fila | **Solo en el servidor de la API.** Nunca en la web ni en la app móvil |
| **Supabase:** `DATABASE_URL` (cadena de conexión de PostgreSQL) | Que la API y Alembic lean y escriban en la base de datos | `.env` y secretos del hosting de la API |
| **Hosting de la API:** cuenta de Render, Railway o Fly.io | Publicar el servicio del modelo | Panel del hosting; ahí se cargan las variables secretas |
| **Hosting de la web:** cuenta de Vercel o Netlify | Publicar la web de Sergio con HTTPS | Panel del hosting (variable `VITE_API_URL` con la URL de la API) |
| **Expo:** cuenta y `EXPO_TOKEN` | Compilar la app móvil con EAS | `.env` local y secretos de CI |
| **Google Play y Apple Developer** (solo si se publica en tiendas) | Distribuir la app | Cuentas del equipo. Son de pago (confirmar precio y requisitos vigentes) |
| **Sentry:** `SENTRY_DSN` (opcional) | Enterarse de los errores en producción | `.env` y secretos del hosting |
| **Dominio propio** (opcional) | Una dirección fácil, como `vinoscore.tubodega.mx` | Registro del dominio y configuración DNS en el hosting |

### C. Material del equipo

- [ ] **El enlace al prototipo de Figma:** para alinear las pantallas de la app con el diseño de Diego. *Se pone en:* este repositorio (por ejemplo, en el README).
- [ ] **El logo o el nombre final:** hoy es "VinoScore" con un icono provisional (`web/public/icono.svg`). *Se pone en:* `web/public/` y `web/vite.config.ts` (nombre y colores de la app instalada).
- [ ] **La fecha de la presentación final:** para ordenar el calendario de abajo.

---

## Parte 3. Calendario sugerido por semanas

Las fechas se llenan cuando el equipo las confirme. El orden está pensado para validar primero lo que más puede cambiar el rumbo (los datos de la bodega).

La columna "Propuesto" asigna cada tema según los roles del equipo; es una sugerencia, no un acuerdo.

| Semana | Fechas | Qué se hace | Propuesto | Cómo sabemos que terminó |
|---|---|---|---|---|
| **1** | POR CONFIRMAR | Reunión con Sergio: resolver las preguntas de la Parte 2-A. Decidir Supabase o Firebase. Crear las cuentas (GitHub, Supabase, hosting). | Francisco (gestión), todo el equipo | Todas las ❓ de la Parte 2-A tienen respuesta o fecha de entrega |
| **2** | POR CONFIRMAR | Base en la nube: PostgreSQL en Supabase, migraciones con Alembic y respaldos. Cargar el historial de la bodega si ya llegó. | Francisco (arquitectura) y Elias (datos) | La API corre contra Supabase y las 50 pruebas pasan |
| **3** | POR CONFIRMAR | Usuarios y permisos: inicio de sesión, roles y reglas por fila. | Francisco | La enóloga no puede ver lo de otros; Sergio ve todo |
| **4** | POR CONFIRMAR | Publicación: API y web en línea con HTTPS, dominio y CORS. Monitoreo con Sentry. | Francisco | Sergio abre la web desde su casa con su cuenta |
| **5** | POR CONFIRMAR | Modelo con datos de la bodega: ajustar variables, reentrenar, comparar con el actual, revisar calibración. | Elias | Informe de métricas nuevas vs. actuales, aprobado por el equipo |
| **6** | POR CONFIRMAR | App móvil nativa: captura, sin conexión completo y cámara. Alinear pantallas con Figma. | Diego (UX/UI) y Francisco | La enóloga captura un lote sin red y se sincroniza solo |
| **7** | POR CONFIRMAR | Ciclo de aprendizaje (tabla `catas`, métricas mensuales) y reportes en PDF y Excel. Notificaciones. | Elias y Diego | Reporte mensual de ejemplo revisado por Sergio |
| **8** | POR CONFIRMAR | Calidad y seguridad: pruebas de punta a punta, bitácora, aviso de privacidad (LFPDPPP). Ensayo y material de la presentación. | Todo el equipo | Lista de verificación de entrega completa |
| **Entrega final** | POR CONFIRMAR | Presentación final. | Todo el equipo | |

**Riesgos que mueven el calendario:**
- Si el historial de la bodega **no llega a tiempo o son muy pocos lotes**, la semana 5 se reduce a documentar cómo reentrenar y el modelo de este prototipo se sigue presentando como demostración.
- Si el laboratorio **no mide alguna de las 11 variables**, el reentrenamiento sin ella puede bajar la precisión: se mide en la semana 5.
- La **app nativa** (semana 6) es lo que más puede crecer. Si el tiempo aprieta, la PWA actual ya cubre captura y modo sin conexión básico.
