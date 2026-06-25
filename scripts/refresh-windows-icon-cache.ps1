# Refresca la caché de iconos de Windows (Explorer) tras cambiar EditCore.exe / instalador.
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Refrescando caché de iconos de Windows..." -ForegroundColor Cyan

$ie4u = Join-Path $env:WINDIR 'System32\ie4uinit.exe'
if (Test-Path $ie4u) {
  Start-Process $ie4u -ArgumentList '-show' -Wait
  Write-Host "ie4uinit -show ejecutado." -ForegroundColor Green
}

$explorer = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'
Get-ChildItem $explorer -Filter 'iconcache*' | Remove-Item -Force
Get-ChildItem $explorer -Filter 'thumbcache*' | Remove-Item -Force

Write-Host "Reiniciando Explorer..." -ForegroundColor Yellow
Stop-Process -Name explorer -Force
Start-Process explorer

Write-Host "Listo. Abre de nuevo la carpeta D:\EDITCORE y revisa los iconos." -ForegroundColor Green
