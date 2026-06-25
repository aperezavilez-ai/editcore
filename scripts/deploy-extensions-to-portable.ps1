# Copia extensiones EditCore al build portable (sin carpetas anidadas corruptas).
param(
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$Portable = Join-Path $Root "VSCode-win32-x64\resources\app\extensions"

function Invoke-Npm {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  # npm escribe avisos (deprecated) en stderr; PowerShell los trata como error nativo.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & npm @Arguments --loglevel=error 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
      throw "npm $($Arguments -join ' ') fallo con codigo $LASTEXITCODE"
    }
  } finally {
    $ErrorActionPreference = $prev
  }
}

foreach ($name in @("editcore-connect", "editcore-claude")) {
  $src = Join-Path $Root "extensions\$name"
  $dest = Join-Path $Portable $name
  if (-not (Test-Path $src)) {
    Write-Warning "No existe $src"
    continue
  }
  Push-Location $src
  Invoke-Npm @("run", "compile")
  Pop-Location
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  robocopy $src $dest /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy fallo para $name" }
  Push-Location $dest
  Invoke-Npm @("install", "--omit=dev")
  Pop-Location
  Write-Host "OK: $name -> $dest" -ForegroundColor Green
}

Write-Host ""
Write-Host "Deploy completo. Abre VSCode-win32-x64\EditCore.exe y recarga (Ctrl+Alt+R)." -ForegroundColor Cyan
