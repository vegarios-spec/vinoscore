# VinoScore - atajos (necesita make; en Windows usa iniciar.ps1)
# NOTA: este Makefile no se pudo probar en la máquina donde se desarrolló (Windows sin make).

PY ?= python3
VENV = .venv/bin/python

.PHONY: iniciar instalar modelo demo web correr dev pruebas limpiar

iniciar: instalar modelo web demo correr   ## todo en un comando

instalar:
	$(PY) -m venv .venv
	$(VENV) -m pip install --upgrade pip
	$(VENV) -m pip install -r requirements.txt

modelo:
	$(VENV) modelo/entrenar.py

demo:
	$(VENV) -m api.sembrar_demo --solo-si-vacio

web:
	cd web && npm install --no-audit --no-fund && npm run build

correr:
	$(VENV) -m uvicorn api.main:app --host 0.0.0.0 --port 8000

dev:  ## API con recarga + web en modo desarrollo (http://localhost:5173)
	$(VENV) -m uvicorn api.main:app --reload --port 8000 & cd web && npm run dev

pruebas:
	$(VENV) -m pytest api/tests -q

limpiar:
	rm -rf .venv web/node_modules web/dist vinoscore.db
