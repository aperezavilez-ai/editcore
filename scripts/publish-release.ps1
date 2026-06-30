# EditCore - Publicar un release ya empaquetado localmente
# Requiere: haber corrido antes scripts\package-release.ps1 (genera dist/ y releases/latest.json)
# y tener el GitHub CLI (gh) instalado y autenticado (gh auth login).
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$VERSION = (Get-Content (Join-Path $ROOT "VERSION") -Raw).Trim()
$DIST = Join-Path $ROOT "dist"
$TAG = "v$VERSION"

if (-not (Test-Path $DIST)) {
  throw "No existe dist/. Corre primero scripts\package-release.ps1"
}

$artifacts = Get-ChildItem -Path $DIST -File | Where-Object { $_.Name -notin @("RELEASE_NOTES.txt") }
if ($artifacts.Count -eq 0) {
  throw "dist/ no tiene artefactos para publicar."
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  throw "No se encontro el GitHub CLI (gh). Instalalo desde https://cli.github.com/ y corre 'gh auth login'."
}

Write-Host ""
Write-Host "=== Publicando EditCore $TAG ===" -ForegroundColor Cyan

# Crear el tag si no existe
$existingTag = git -C $ROOT tag -l $TAG
if (-not $existingTag) {
  git -C $ROOT tag $TAG
  git -C $ROOT push origin $TAG
  Write-Host "Tag $TAG creado y subido." -ForegroundColor Green
} else {
  Write-Host "Tag $TAG ya existia, se reusa." -ForegroundColor Yellow
}

$notesPath = Join-Path $DIST "RELEASE_NOTES.txt"
$releaseExists = gh release view $TAG --repo aperezavilez-ai/editcore 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "El release $TAG ya existe en GitHub, subiendo/actualizando artefactos..." -ForegroundColor Yellow
  gh release upload $TAG $($artifacts.FullName) --repo aperezavilez-ai/editcore --clobber
} else {
  if (Test-Path $notesPath) {
    gh release create $TAG $($artifacts.FullName) --repo aperezavilez-ai/editcore --title "EditCore $VERSION" --notes-file $notesPath
  } else {
    gh release create $TAG $($artifacts.FullName) --repo aperezavilez-ai/editcore --title "EditCore $VERSION" --generate-notes
  }
}
Write-Host "Release $TAG publicado en GitHub." -ForegroundColor Green

# Regenerar manifiestos apuntando al release ya publicado y subirlos a main
node (Join-Path $ROOT "scripts\generate-release-manifest.js") $VERSION

git -C $ROOT add releases/latest.json releases/update/win32-x64/stable.json
$hasChanges = git -C $ROOT diff --cached --quiet; if ($LASTEXITCODE -ne 0) {
  git -C $ROOT commit -m "Publica EditCore $VERSION y actualiza releases/latest.json"
  git -C $ROOT push origin main
  Write-Host "releases/latest.json actualizado y pusheado a main." -ForegroundColor Green
} else {
  Write-Host "releases/latest.json ya estaba al dia, no hay cambios que pushear." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Listo. La web (account.html) mostrara $VERSION en cuanto Vercel sirva el latest.json actualizado." -ForegroundColor Cyan
