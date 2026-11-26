<#
.SYNOPSIS
  Instala (si hace falta) y arranca VinoScore completo con un solo comando.

.DESCRIPTION
  1. Crea el entorno de Python e instala las dependencias.
  2. Entrena el modelo si falta el archivo .joblib.
  3. Compila la web si falta o si su código cambió, e instala sus dependencias
     si cambiaron (necesita Node.js; si no está, solo arranca la API).
  4. Carga los lotes de demostración si la base de datos está vacía.
  5. Arranca el servidor y abre el navegador.

.EXAMPLE
  .\iniciar.ps1
  .\iniciar.ps1 -SinDemo          # no cargar datos de demostración
  .\iniciar.ps1 -Puerto 9000
  .\iniciar.ps1 -Reconstruir      # volver a compilar la web aunque no haya cambios
#>
param(
  [int]$Puerto = 8000,
  [switch]$SinDemo,
  [switch]$Reconstruir,
  [switch]$NoAbrir
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }

# --- Python -----------------------------------------------------------------
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { throw "No se encontró Python 3.11 o superior. Instálalo desde https://www.python.org/downloads/" }

$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  Paso "Creando el entorno de Python (.venv)"
  & $py.Source -m venv .venv
}
$marca = Join-Path $PSScriptRoot ".venv\.dependencias-ok"
if (-not (Test-Path $marca) -or ((Get-Item requirements.txt).LastWriteTime -gt (Get-Item $marca).LastWriteTime)) {
  Paso "Instalando dependencias de Python"
  & $venvPy -m pip install --quiet --upgrade pip
  & $venvPy -m pip install --quiet -r requirements.txt
  New-Item -ItemType File -Force $marca | Out-Null
}

# --- Modelo -----------------------------------------------------------------
if (-not (Test-Path "modelo\vinoscore_rf.joblib") -or -not (Test-Path "modelo\metricas.json")) {
  Paso "Entrenando el modelo (unos segundos)"
  & $venvPy modelo\entrenar.py
  if ($LASTEXITCODE -ne 0) { throw "El entrenamiento no terminó bien. Revisa el mensaje de arriba." }
}

# --- Web --------------------------------------------------------------------
# Se compila si se pide, si no hay compilación o si el código de la web es más nuevo
# que la compilación (por ejemplo, después de un git pull).
function Mas-Reciente($rutas) {
  Get-ChildItem $rutas -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty LastWriteTime
}
$compilada = "web\dist\index.html"
$codigoNuevo = (Test-Path $compilada) -and
  ((Mas-Reciente @("web\src", "web\public", "web\index.html", "web\package.json", "web\package-lock.json", "web\vite.config.ts")) -gt (Get-Item $compilada).LastWriteTime)
if ($codigoNuevo) { Write-Host "El código de la web cambió desde la última compilación." }

if ($Reconstruir -or $codigoNuevo -or -not (Test-Path $compilada)) {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    Paso "Compilando la web"
    Push-Location web
    try {
      # npm deja una copia de la lista instalada en node_modules\.package-lock.json:
      # si package-lock.json es más nuevo, cambiaron las dependencias y hay que instalarlas.
      $instalada = "node_modules\.package-lock.json"
      if (-not (Test-Path $instalada) -or ((Get-Item package-lock.json).LastWriteTime -gt (Get-Item $instalada).LastWriteTime)) {
        Paso "Instalando dependencias de la web"
        npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias de la web." }
      }
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar la web." }
    } finally { Pop-Location }
  } else {
    Write-Warning "Node.js no está instalado: se arranca solo la API (documentación en /docs). Instálalo desde https://nodejs.org para tener la web."
  }
}

# --- Datos de demostración --------------------------------------------------
if (-not $SinDemo) {
  Paso "Datos de demostración"
  & $venvPy -m api.sembrar_demo --solo-si-vacio
}

# --- Servidor ---------------------------------------------------------------
$url = "http://localhost:$Puerto"
Paso "VinoScore listo en $url   (Ctrl+C para detenerlo)"
Write-Host "  Enóloga: $url          Sergio: $url/?rol=sergio          API: $url/docs"
if (-not $NoAbrir) { Start-Process $url }
& $venvPy -m uvicorn api.main:app --host 0.0.0.0 --port $Puerto
