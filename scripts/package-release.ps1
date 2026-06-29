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

$iconScript = Join-Path $ROOT "scripts\generate-editcore-icons.py"
if (Test-Path $iconScript) {
  $prevErr = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  python $iconScript 2>&1 | Out-Host
  $ErrorActionPreference = $prevErr
}

$iconIco = Join-Path $ROOT "branding\icons\win32\code.ico"
$setupSrcRoot = Join-Path $ROOT "EditCoreUserSetup-x64.exe"
$setupBuilt = Join-Path $ROOT "editcore-src\.build\win32-x64\user-setup\EditCoreUserSetup.exe"
$buildInstaller = Join-Path $ROOT "scripts\build-win-installer.ps1"
$repoIco = Join-Path $ROOT "editcore-src\resources\win32\code.ico"
if ((Test-Path $buildInstaller) -and (Test-Path (Join-Path $ROOT "editcore-src"))) {
  $needRebuild = $false
  if (-not (Test-Path $setupBuilt)) { $needRebuild = $true }
  elseif ((Test-Path $iconIco) -and (Get-Item $iconIco).LastWriteTime -gt (Get-Item $setupBuilt).LastWriteTime) { $needRebuild = $true }
  elseif ((Test-Path $repoIco) -and (Test-Path $iconIco) -and ((Get-FileHash $repoIco).Hash -ne (Get-FileHash $iconIco).Hash)) { $needRebuild = $true }
  if ($needRebuild) {
    Write-Host "Recompilando instalador Inno (logo actualizado)..." -ForegroundColor Cyan
    $prevErr = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $buildInstaller -SetupOnly 2>&1 | Out-Host
    $ErrorActionPreference = $prevErr
    if ($LASTEXITCODE -ne 0) {
      Write-Host "AVISO: build-win-installer.ps1 fallo — se omite el instalador .exe." -ForegroundColor Yellow
    }
  }
}
if ((Test-Path $setupBuilt) -and ((Test-Path $setupSrcRoot) -eq $false -or (Get-Item $setupBuilt).Length -gt (Get-Item $setupSrcRoot).Length)) {
  Copy-Item $setupBuilt $setupSrcRoot -Force
  Write-Host "Instalador Inno listo: $setupSrcRoot" -ForegroundColor Green
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
  "Logo oficial actualizado en instalador, IDE y pagina web."
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
