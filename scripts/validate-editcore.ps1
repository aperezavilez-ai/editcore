# EditCore - Validacion rapida del repo (ASCII, UTF-8 BOM)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

Step "Extensiones - compile + test"
Push-Location (Join-Path $ROOT "extensions\editcore-claude")
npm install --silent
npm run compile
npm test
Pop-Location

Push-Location (Join-Path $ROOT "extensions\editcore-connect")
npm install --silent
npm run compile
Pop-Location

Step "Parches EditCore"
$repo = Join-Path $ROOT "editcore-src"
if (Test-Path $repo) {
  node (Join-Path $ROOT "scripts\apply-editcore-patches.js") $repo
} else {
  Write-Host "editcore-src no existe - omitiendo parches (corre build-editcore.ps1)." -ForegroundColor Yellow
}

Step "Iconos"
$genIcons = Join-Path $ROOT "scripts\generate-editcore-icons.py"
if (Test-Path $genIcons) {
  python $genIcons
}

Step "Branding"
$product = Join-Path $ROOT "branding\product.json"
if (-not (Test-Path $product)) { throw "Falta branding\product.json" }
Write-Host "OK product.json" -ForegroundColor Green

$REBRAND = Join-Path $ROOT "scripts\rebrand-editcore-strings.js"
if (Test-Path $REBRAND) {
  node $REBRAND $ROOT
  node $REBRAND $ROOT --check
  if ($LASTEXITCODE -ne 0) { throw "Validacion de branding fallo" }
  Write-Host "OK rebranding EditCore" -ForegroundColor Green
}

Write-Host "`nValidacion completada." -ForegroundColor Green
