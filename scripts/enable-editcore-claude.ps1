# Habilita editcore-claude si VS Code la desactivó automáticamente.
# Cierra EditCore antes de ejecutar.
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path $PSScriptRoot -Parent
node (Join-Path $PSScriptRoot "enable-editcore-claude.js")
Write-Host ""
Write-Host "Si EditCore estaba abierto, ciérralo y vuelve a abrir VSCode-win32-x64\EditCore.exe" -ForegroundColor Cyan
