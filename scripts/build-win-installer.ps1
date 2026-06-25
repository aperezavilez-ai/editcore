# =============================================================
# EditCore - Generar build portable + instalador Windows
# =============================================================
# Requiere editcore-src con dependencias (build-editcore.ps1 previo).
#
# Genera:
#   ..\VSCode-win32-x64\EditCore.exe          (portable)
#   EditCoreUserSetup-x64.exe                   (instalador en la raiz)
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\build-win-installer.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-win-installer.ps1 -SetupOnly
# =============================================================

param(
  [switch]$SetupOnly
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$REPO = Join-Path $ROOT "editcore-src"

if (-not (Test-Path $REPO)) {
  Write-Host "No existe editcore-src. Ejecuta primero scripts\build-editcore.ps1" -ForegroundColor Red
  exit 1
}

$nodeModules = Join-Path $REPO "node_modules"
if (-not (Test-Path $nodeModules)) {
  Write-Host "Faltan dependencias en editcore-src. Ejecuta build-editcore.ps1 o npm install en editcore-src." -ForegroundColor Red
  exit 1
}

$MERGE = Join-Path $ROOT "scripts\merge-product-json.js"
$BRANDING = Join-Path $ROOT "branding\product.json"
$UPSTREAM = Join-Path $REPO "product.json.upstream"
$PATCHES = Join-Path $ROOT "scripts\apply-editcore-patches.js"
if ((Test-Path $MERGE) -and (Test-Path $BRANDING)) {
  if (-not (Test-Path $UPSTREAM)) {
    Copy-Item (Join-Path $REPO "product.json") $UPSTREAM -Force
  }
  node $MERGE $UPSTREAM $BRANDING (Join-Path $REPO "product.json.merged")
  Move-Item -Force (Join-Path $REPO "product.json.merged") (Join-Path $REPO "product.json")
  if (Test-Path $PATCHES) { node $PATCHES $REPO }
  Write-Host "product.json y parches EditCore aplicados." -ForegroundColor Green
}

Push-Location $REPO
try {
  $env:GYP_MSVS_VERSION = "2022"

  if (-not $SetupOnly) {
    Write-Host ""
    Write-Host "=== EditCore: build portable win32-x64 ===" -ForegroundColor Cyan
    npm run gulp -- vscode-win32-x64
    if ($LASTEXITCODE -ne 0) { throw "gulp vscode-win32-x64 fallo con codigo $LASTEXITCODE" }

    $portable = Join-Path $ROOT "VSCode-win32-x64\EditCore.exe"
    if (Test-Path $portable) {
      Write-Host "Portable: $portable" -ForegroundColor Green
    }
  }

  Write-Host ""
  Write-Host "=== EditCore: herramientas Inno (inno_updater) ===" -ForegroundColor Cyan
  npm run gulp -- vscode-win32-x64-inno-updater
  if ($LASTEXITCODE -ne 0) { throw "gulp vscode-win32-x64-inno-updater fallo con codigo $LASTEXITCODE" }

  Write-Host ""
  Write-Host "=== EditCore: instalador usuario (EditCoreUserSetup.exe) ===" -ForegroundColor Cyan
  npm run gulp -- vscode-win32-x64-user-setup
  if ($LASTEXITCODE -ne 0) { throw "gulp vscode-win32-x64-user-setup fallo con codigo $LASTEXITCODE" }

  $userSetup = Join-Path $REPO ".build\win32-x64\user-setup\EditCoreUserSetup.exe"
  if (Test-Path $userSetup) {
    $distUser = Join-Path $ROOT "EditCoreUserSetup-x64.exe"
    Copy-Item $userSetup $distUser -Force
    Write-Host "Instalador usuario: $userSetup" -ForegroundColor Green
    Write-Host "Copia en raiz:      $distUser" -ForegroundColor Green
  } else {
    Write-Host "No se encontro EditCoreUserSetup.exe - revisa el log de gulp." -ForegroundColor Yellow
  }

  $sysSetupDir = Join-Path $REPO ".build\win32-x64\system-setup"
  if (Test-Path $sysSetupDir) {
    Remove-Item $sysSetupDir -Recurse -Force
    Write-Host "Eliminado instalador sistema antiguo: $sysSetupDir" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "Build EditCore completado." -ForegroundColor Green
} finally {
  Pop-Location
}

$REBRAND = Join-Path $ROOT "scripts\rebrand-editcore-strings.js"
if (Test-Path $REBRAND) {
  node $REBRAND $ROOT
  Write-Host "Rebrand aplicado al portable antes del instalador." -ForegroundColor Green
}
