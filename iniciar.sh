#!/usr/bin/env bash
# Instala (si hace falta) y arranca VinoScore completo con un solo comando.
#   ./iniciar.sh                # normal
#   PUERTO=9000 ./iniciar.sh    # otro puerto
#   SIN_DEMO=1 ./iniciar.sh     # sin datos de demostración
#   RECONSTRUIR=1 ./iniciar.sh  # volver a compilar la web
set -euo pipefail
cd "$(dirname "$0")"

PUERTO="${PUERTO:-8000}"
paso() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }

PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || { echo "No se encontró Python 3.11 o superior."; exit 1; }

if [ ! -x .venv/bin/python ]; then
  paso "Creando el entorno de Python (.venv)"
  "$PY" -m venv .venv
fi
VENV=".venv/bin/python"
if [ ! -f .venv/.dependencias-ok ] || [ requirements.txt -nt .venv/.dependencias-ok ]; then
  paso "Instalando dependencias de Python"
  "$VENV" -m pip install --quiet --upgrade pip
  "$VENV" -m pip install --quiet -r requirements.txt
  touch .venv/.dependencias-ok
fi

if [ ! -f modelo/vinoscore_rf.joblib ] || [ ! -f modelo/metricas.json ]; then
  paso "Entrenando el modelo (unos segundos)"
  "$VENV" modelo/entrenar.py
fi

if [ -n "${RECONSTRUIR:-}" ] || [ ! -f web/dist/index.html ]; then
  if command -v npm >/dev/null 2>&1; then
    paso "Compilando la web"
    (cd web && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npm run build)
  else
    echo "AVISO: Node.js no está instalado; se arranca solo la API (documentación en /docs)."
  fi
fi

if [ -z "${SIN_DEMO:-}" ]; then
  paso "Datos de demostración"
  "$VENV" -m api.sembrar_demo --solo-si-vacio
fi

paso "VinoScore listo en http://localhost:$PUERTO   (Ctrl+C para detenerlo)"
echo "  Enóloga: http://localhost:$PUERTO     Sergio: http://localhost:$PUERTO/?rol=sergio     API: http://localhost:$PUERTO/docs"
exec "$VENV" -m uvicorn api.main:app --host 0.0.0.0 --port "$PUERTO"
