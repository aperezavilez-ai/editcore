# Compila extensiones EditCore en modo release (sin source maps).
param(
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"

function Invoke-NpmRelease {
  param([Parameter(Mandatory = $true)][string]$Dir)

  Push-Location $Dir
  try {
    if (Test-Path "out") { Remove-Item "out" -Recurse -Force }
    npm run compile:release --loglevel=error
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "compile:release fallo en $Dir" }
    Get-ChildItem -Path "out" -Filter "*.map" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
  } finally {
    Pop-Location
  }
}

node (Join-Path $Root "scripts\sync-product-version.js")

foreach ($name in @("editcore-claude", "editcore-connect")) {
  $ext = Join-Path $Root "extensions\$name"
  if (-not (Test-Path $ext)) { throw "No existe $ext" }
  Write-Host "Release compile: $name" -ForegroundColor Cyan
  Push-Location $ext
  npm install --loglevel=error 2>&1 | Out-Null
  Pop-Location
  Invoke-NpmRelease $ext
  Write-Host "OK: $name (sin .map)" -ForegroundColor Green
}

Write-Host "Extensiones listas para empaquetar." -ForegroundColor Green
