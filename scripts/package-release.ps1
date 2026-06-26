# EditCore - Empaquetar producto descargable para distribucion
# Uso: powershell -ExecutionPolicy Bypass -File scripts\package-release.ps1

param(
  [switch]$SkipPortableZip,
  [switch]$SkipDeployExtensions
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$VERSION = (Get-Content (Join-Path $ROOT "VERSION") -Raw).Trim()
$DIST = Join-Path $ROOT "dist"
$PORTABLE_DIR = Join-Path $ROOT "VSCode-win32-x64"

$iconScript = Join-Path $ROOT "scripts\generate-win32-ico.js"
if (Test-Path $iconScript) {
  node $iconScript 2>&1 | Out-Host
}
$applyIcon = Join-Path $ROOT "scripts\apply-exe-icon.js"
if (Test-Path $applyIcon) {
  node $applyIcon 2>&1 | Out-Host
}

Write-Host ""
Write-Host "=== EditCore package-release v$VERSION ===" -ForegroundColor Cyan

& (Join-Path $ROOT "scripts\compile-extensions-release.ps1")

if (-not $SkipDeployExtensions) {
  if (Test-Path $PORTABLE_DIR) {
    & (Join-Path $ROOT "scripts\deploy-extensions-to-portable.ps1") -Root $ROOT
    $checksumScript = Join-Path $ROOT "scripts\update-product-checksums.js"
    if (Test-Path $checksumScript) {
      node $checksumScript $ROOT
    }
  } else {
    Write-Host "AVISO: No hay VSCode-win32-x64." -ForegroundColor Yellow
  }
}

New-Item -ItemType Directory -Path $DIST -Force | Out-Null

$artifacts = @()

if (-not $SkipPortableZip -and (Test-Path $PORTABLE_DIR)) {
  $zipName = "EditCore-$VERSION-win32-x64-portable.zip"
  $zipPath = Join-Path $DIST $zipName
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

  Write-Host "Comprimiendo portable..." -ForegroundColor Cyan
  Compress-Archive -Path $PORTABLE_DIR -DestinationPath $zipPath -CompressionLevel Optimal
  $artifacts += $zipPath
  Write-Host "OK: $zipPath" -ForegroundColor Green
}

$setupSrc = Join-Path $ROOT "EditCoreUserSetup-x64.exe"
$setupDest = Join-Path $DIST "EditCore-$VERSION-win32-x64-setup.exe"
if (Test-Path $setupSrc) {
  Copy-Item $setupSrc $setupDest -Force
  $artifacts += $setupDest
  Write-Host "OK: $setupDest" -ForegroundColor Green
} else {
  Write-Host "Sin instalador EditCoreUserSetup-x64.exe" -ForegroundColor Yellow
}

$hashLines = @()
foreach ($file in $artifacts) {
  $hash = (Get-FileHash -Path $file -Algorithm SHA256).Hash.ToLower()
  $name = Split-Path $file -Leaf
  $hashLines += "$hash  $name"
}
$hashFile = Join-Path $DIST "SHA256SUMS.txt"
$hashLines | Set-Content $hashFile -Encoding utf8

$artifactList = ($artifacts | ForEach-Object { " - " + (Split-Path $_ -Leaf) }) -join [Environment]::NewLine
$notesPath = Join-Path $DIST "RELEASE_NOTES.txt"
@(
  "EditCore IDE $VERSION"
  "===================="
  ""
  "Descarga: docs/DOWNLOAD.md"
  ""
  "Archivos:"
  $artifactList
  ""
  "SHA256: ver SHA256SUMS.txt"
  ""
  "Requisitos: Windows 10/11 x64, internet para APIs."
  ""
  "Licencia: MIT + docs/TERMS.md"
) | Set-Content $notesPath -Encoding utf8

node (Join-Path $ROOT "scripts\generate-release-manifest.js") $VERSION
node (Join-Path $ROOT "scripts\sync-product-version.js")

Write-Host ""
Write-Host "Empaquetado completo en: $DIST" -ForegroundColor Green
Write-Host "Publicar: gh release create v$VERSION dist/* --title EditCore-$VERSION --notes-file dist/RELEASE_NOTES.txt" -ForegroundColor Cyan
