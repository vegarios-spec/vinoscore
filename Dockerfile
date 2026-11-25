# VinoScore en un solo contenedor: API de Python + web ya compilada.
# NOTA: no se pudo probar en la máquina de desarrollo (no tenía Docker).

# --- 1) Compilar la web ------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- 2) API + web ---------------------------------------------------------------
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY api ./api
COPY modelo ./modelo
COPY data ./data
COPY --from=web /web/dist ./web/dist

# La base de datos vive en un volumen para que no se pierda al reiniciar.
ENV DATABASE_URL=sqlite:////datos/vinoscore.db
VOLUME /datos
EXPOSE 8000

CMD ["sh", "-c", "python -m api.sembrar_demo --solo-si-vacio && uvicorn api.main:app --host 0.0.0.0 --port 8000"]
