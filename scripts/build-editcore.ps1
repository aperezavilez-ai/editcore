# =============================================================
# EditCore IDE — Script de construcción automatizada (Windows)
# =============================================================
# Clona Code-OSS, aplica el branding de EditCore, inyecta las
# extensiones propias como built-in, y compila el editor completo.
#
# Este script incluye TODOS los arreglos descubiertos durante las
# pruebas reales en Windows con Node.js 24 + Code-OSS reciente:
#   - Valida que la ruta del proyecto no tenga espacios (causaba
#     que la herramienta "tsgo" rompiera rutas a la mitad).
#   - Quita las extensiones de fábrica "copilot" y
#     "mermaid-markdown-features", que tienen bugs propios de
#     compilación no relacionados con EditCore.
#   - Limpia las referencias a esas extensiones en
#     build/lib/extensions.ts para que gulp no intente tocarlas.
#   - Arregla un bug real en build/lib/tsgo.ts (el flag
#     "--pretty false" rompe el parser de tsgo).
#   - Corrige el script "compile" de package.json para que no
#     dependa de tareas que no existen.
#   - Instala las dependencias de TODAS las extensiones de fábrica
#     de una sola vez (muchas no traen su node_modules listo).
#
# Requisitos previos (instalar ANTES de correr este script):
#   - Node.js 18.x o superior   https://nodejs.org/
#   - Python 3.x                https://www.python.org/downloads/
#   - Git                       https://git-scm.com/download/win
#   - Visual Studio Build Tools 2022
#     (workload: "Desktop development with C++")
#
# IMPORTANTE: corre este script desde una ruta SIN ESPACIOS,
# por ejemplo D:\EditCore — nunca algo como "D:\Mis Programas\...".
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File build-editcore.ps1
# =============================================================

$ErrorActionPreference = "Stop"

$ROOT       = Get-Location
$REPO_DIR   = Join-Path $ROOT "editcore-src"
$PRODUCT    = Join-Path $ROOT "branding\product.json"

function Step($msg) {
  Write-Host ""
  Write-Host "=== $msg ===" -ForegroundColor Cyan
}

# ---------------------------------------------------------------
Step "1/11 — Verificando que la ruta no tenga espacios"
# ---------------------------------------------------------------
if ("$ROOT" -match '\s') {
  Write-Host "ERROR: la ruta actual contiene espacios:" -ForegroundColor Red
  Write-Host "  $ROOT" -ForegroundColor Red
  Write-Host "Code-OSS usa una herramienta (tsgo) que se rompe con rutas con espacios." -ForegroundColor Red
  Write-Host "Mueve esta carpeta a una ruta sin espacios (ej. D:\EditCore) y vuelve a correr el script." -ForegroundColor Yellow
  exit 1
}
Write-Host "Ruta correcta, sin espacios: $ROOT" -ForegroundColor Green

# ---------------------------------------------------------------
Step "2/11 — Verificando requisitos"
# ---------------------------------------------------------------
$tools = @("node", "npm", "python", "git")
foreach ($t in $tools) {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
    Write-Host "Falta '$t' en el PATH. Instálalo antes de continuar." -ForegroundColor Red
    exit 1
  }
}
node --version
npm --version
python --version
git --version

# ---------------------------------------------------------------
Step "3/11 — Clonando Code-OSS (microsoft/vscode)"
# ---------------------------------------------------------------
if (Test-Path $REPO_DIR) {
  Write-Host "El directorio '$REPO_DIR' ya existe. Saltando clonado." -ForegroundColor Yellow
} else {
  git clone --depth 1 https://github.com/microsoft/vscode.git $REPO_DIR
}

# ---------------------------------------------------------------
Step "4/11 — Aplicando branding de EditCore (product.json + ícono)"
# ---------------------------------------------------------------
$MERGE_SCRIPT = Join-Path $ROOT "scripts\merge-product-json.js"
$UPSTREAM_PRODUCT = Join-Path $REPO_DIR "product.json"
$MERGED_PRODUCT   = Join-Path $REPO_DIR "product.json.merged"
$UPSTREAM_BACKUP = Join-Path $REPO_DIR "product.json.upstream"

Push-Location $REPO_DIR
$upstreamJson = git show HEAD:product.json 2>$null
if ($LASTEXITCODE -eq 0) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($UPSTREAM_BACKUP, $upstreamJson, $utf8NoBom)
  Write-Host "Base de product.json tomada desde git (HEAD)." -ForegroundColor DarkCyan
} elseif (-not (Test-Path $UPSTREAM_BACKUP)) {
  Copy-Item $UPSTREAM_PRODUCT $UPSTREAM_BACKUP -Force
  Write-Host "Respaldo del product.json actual guardado en product.json.upstream" -ForegroundColor DarkCyan
}
Pop-Location

node $MERGE_SCRIPT $UPSTREAM_BACKUP $PRODUCT $MERGED_PRODUCT
Move-Item $MERGED_PRODUCT $UPSTREAM_PRODUCT -Force
Write-Host "product.json fusionado (branding EditCore + campos requeridos de Code-OSS)." -ForegroundColor Green

$APPLY_PATCHES = Join-Path $ROOT "scripts\apply-editcore-patches.js"
if (Test-Path $APPLY_PATCHES) {
  node $APPLY_PATCHES $REPO_DIR
  Write-Host "Parches de UI EditCore aplicados sobre editcore-src." -ForegroundColor Green
}

$DEFAULT_SETTINGS = Join-Path $ROOT "branding\default-settings.json"
$USER_SETTINGS = Join-Path $env:APPDATA "code-oss-dev\User\settings.json"
if (Test-Path $DEFAULT_SETTINGS) {
  node (Join-Path $ROOT "scripts\apply-default-settings.js") $DEFAULT_SETTINGS $USER_SETTINGS
  Write-Host "Ajustes por defecto de EditCore aplicados en settings.json (dev)." -ForegroundColor Green
}

$GEN_ICONS = Join-Path $ROOT "scripts\generate-editcore-icons.py"
if (Test-Path $GEN_ICONS) {
  python $GEN_ICONS
  Write-Host "Íconos EditCore generados desde branding/icons/editcore-logo.png." -ForegroundColor Green
}

$ICON_WIN32 = Join-Path $ROOT "branding\icons\win32\code.ico"
$ICON_DEST  = Join-Path $REPO_DIR "resources\win32\code.ico"
if (Test-Path $ICON_WIN32) {
  Copy-Item $ICON_WIN32 $ICON_DEST -Force
  Write-Host "Ícono de Windows (code.ico) aplicado en resources\win32." -ForegroundColor Green
} else {
  Write-Host "No se encontró branding\icons\win32\code.ico — se usará el ícono por defecto de Code-OSS." -ForegroundColor Yellow
}

# ---------------------------------------------------------------
Step "5/11 — Inyectando extensiones built-in (editcore-claude, editcore-connect)"
# ---------------------------------------------------------------
$extensionsToInject = @("editcore-claude", "editcore-connect")
foreach ($extName in $extensionsToInject) {
  $srcExt  = Join-Path $ROOT "extensions\$extName"
  $destExt = Join-Path $REPO_DIR "extensions\$extName"
  if (Test-Path $destExt) { Remove-Item $destExt -Recurse -Force }
  Copy-Item $srcExt $destExt -Recurse
  Write-Host "Extensión '$extName' copiada." -ForegroundColor Green

  Push-Location $destExt
  Write-Host "Instalando dependencias de '$extName'..."
  npm install
  Write-Host "Compilando '$extName'..."
  npm run compile
  Pop-Location
}

# ---------------------------------------------------------------
Step "6/11 — Quitando extensiones de fabrica con bugs de compilacion conocidos"
# ---------------------------------------------------------------
$extensionsToRemove = @("copilot", "mermaid-markdown-features")
foreach ($extName in $extensionsToRemove) {
  $extPath = Join-Path $REPO_DIR "extensions\$extName"
  if (Test-Path $extPath) {
    Remove-Item -Recurse -Force $extPath
    Write-Host "Extensión de fábrica '$extName' eliminada." -ForegroundColor Green
  }
}

$extensionsTsPath = Join-Path $REPO_DIR "build\lib\extensions.ts"
if (Test-Path $extensionsTsPath) {
  $lines = Get-Content $extensionsTsPath
  # Quita líneas que referencian extensiones eliminadas Y líneas de .pipe()
  # utilitarias que quedarían huérfanas al romper la cadena.
  $cleanLines = $lines | Where-Object {
    $line = $_
    $refersToRemoved = $extensionsToRemove | Where-Object { $line -match [regex]::Escape($_) }
    $orphanedPipe = $line -match "setExecutableBit|cleanNodeModules"
    -not $refersToRemoved -and -not $orphanedPipe
  }
  $cleanLines | Set-Content $extensionsTsPath
  Write-Host "Referencias a extensiones eliminadas limpiadas en build/lib/extensions.ts." -ForegroundColor Green
}

# ---------------------------------------------------------------
Step "7/11 — Arreglando bug de tsgo (--pretty false rompe el parser)"
# ---------------------------------------------------------------
$tsgoPath = Join-Path $REPO_DIR "build\lib\tsgo.ts"
if (Test-Path $tsgoPath) {
  $tsgoContent = Get-Content $tsgoPath -Raw
  $tsgoContent = $tsgoContent -replace "'--pretty',\s*'false',\s*", ""
  $tsgoContent | Set-Content $tsgoPath
  Write-Host "build/lib/tsgo.ts corregido." -ForegroundColor Green
}

# ---------------------------------------------------------------
Step "8/11 — Corrigiendo el script 'compile' de package.json"
# ---------------------------------------------------------------
$pkgJsonPath = Join-Path $REPO_DIR "package.json"
$pkgContent = Get-Content $pkgJsonPath -Raw
$pkgContent = $pkgContent -replace '"compile":\s*"[^"]*"', '"compile": "npm-run-all2 -lp compile-client"'
$pkgContent | Set-Content $pkgJsonPath
Write-Host "package.json: script 'compile' corregido." -ForegroundColor Green

# ---------------------------------------------------------------
Step "9/11 — Instalando CLIs externas (Vercel, Supabase, GitHub)"
# ---------------------------------------------------------------
function Install-IfMissing($cmd, $installCmd, $label) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    Write-Host "$label ya está instalado." -ForegroundColor Yellow
  } else {
    Write-Host "Instalando $label..."
    Invoke-Expression $installCmd
  }
}
Install-IfMissing "vercel"   "npm install -g vercel"           "Vercel CLI"
Install-IfMissing "supabase" "npm install -g supabase"          "Supabase CLI"
Install-IfMissing "gh"       "winget install --id GitHub.cli"   "GitHub CLI"

# ---------------------------------------------------------------
Step "10/11 — Instalando dependencias de TODAS las extensiones de fabrica"
# ---------------------------------------------------------------
$extensionsDir = Join-Path $REPO_DIR "extensions"
Get-ChildItem -Path $extensionsDir -Directory | ForEach-Object {
  $pkgJson = Join-Path $_.FullName "package.json"
  if (Test-Path $pkgJson) {
    Write-Host "Instalando dependencias de extensión: $($_.Name)" -ForegroundColor DarkCyan
    Push-Location $_.FullName
    npm install --no-audit --no-fund
    Pop-Location
  }
}

$buildDir = Join-Path $REPO_DIR "build"
if (Test-Path (Join-Path $buildDir "package.json")) {
  Write-Host "Instalando dependencias de build/..." -ForegroundColor DarkCyan
  Push-Location $buildDir
  npm install --no-audit --no-fund
  Pop-Location
}

# ---------------------------------------------------------------
Step "11/11 — Instalando dependencias del editor y compilando"
# ---------------------------------------------------------------
Push-Location $REPO_DIR
npm install
npm run compile

$REBRAND = Join-Path $ROOT "scripts\rebrand-editcore-strings.js"
if (Test-Path $REBRAND) {
  node $REBRAND $ROOT
  Write-Host "Textos de marca EditCore aplicados (sin Visual Studio Code / Cursor en UI)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Build completado." -ForegroundColor Green
Write-Host "Para abrir EditCore IDE ahora, ejecuta:" -ForegroundColor Green
Write-Host "    cd $REPO_DIR" -ForegroundColor White
Write-Host "    .\scripts\code.bat" -ForegroundColor White
Write-Host ""
Write-Host "Para generar el instalador .exe final, ejecuta:" -ForegroundColor Green
Write-Host "    npm run gulp vscode-win32-x64" -ForegroundColor White
Write-Host ""
Pop-Location
