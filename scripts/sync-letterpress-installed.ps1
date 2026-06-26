# Copia letterpress circular a cualquier instalacion EditCore encontrada en el PC.
param(
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$srcDir = Join-Path $Root "branding\icons\letterpress"
if (-not (Test-Path $srcDir)) {
  Write-Host "Ejecuta primero: python scripts\generate-editcore-icons.py" -ForegroundColor Yellow
  exit 1
}

$targets = @(
  (Join-Path $Root "VSCode-win32-x64\resources\app\out\media"),
  (Join-Path $Root "VSCode-win32-x64\resources\app\out\vs\workbench\browser\parts\editor\media")
)

$candidates = @(
  "$env:LOCALAPPDATA\Programs\EditCore IDE",
  "$env:LOCALAPPDATA\EditCore IDE",
  "${env:ProgramFiles}\EditCore IDE",
  "${env:ProgramFiles(x86)}\EditCore IDE"
)

foreach ($base in $candidates) {
  if (Test-Path $base) {
    $targets += (Join-Path $base "resources\app\out\media")
    $targets += (Join-Path $base "resources\app\out\vs\workbench\browser\parts\editor\media")
  }
}

Get-ChildItem -Path @($env:LOCALAPPDATA, ${env:ProgramFiles}) -Filter EditCore.exe -Recurse -ErrorAction SilentlyContinue |
  Select-Object -First 20 -ExpandProperty DirectoryName |
  ForEach-Object {
    $app = Join-Path $_ "resources\app"
    if (Test-Path $app) {
      $targets += (Join-Path $app "out\media")
      $targets += (Join-Path $app "out\vs\workbench\browser\parts\editor\media")
    }
  }

$targets = $targets | Where-Object { $_ } | Select-Object -Unique
$files = Get-ChildItem $srcDir -Filter "letterpress*.svg"
if (-not $files) { throw "No hay letterpress en $srcDir" }

foreach ($dest in $targets) {
  if (-not (Test-Path $dest)) { continue }
  foreach ($f in $files) {
    Copy-Item $f.FullName (Join-Path $dest $f.Name) -Force
  }
  Write-Host "OK: letterpress -> $dest" -ForegroundColor Green
}

Write-Host ""
Write-Host "Cierra EditCore por completo y vuelve a abrirlo para ver el logo circular." -ForegroundColor Cyan
