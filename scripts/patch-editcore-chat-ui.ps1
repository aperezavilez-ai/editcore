# Parches de UI del chat EditCore (estilo Cursor: Agent + modelo, sin menús Copilot)
# Ejecutar después de clonar Code-OSS: scripts/patch-editcore-chat-ui.ps1

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SRC = Join-Path $ROOT "editcore-src"

if (-not (Test-Path $SRC)) {
  Write-Host "No se encontró editcore-src" -ForegroundColor Red
  exit 1
}

function Patch-File($relPath, $old, $new, $label) {
  $path = Join-Path $SRC $relPath
  if (-not (Test-Path $path)) {
    Write-Host "SKIP $label (no existe $relPath)" -ForegroundColor Yellow
    return
  }
  $content = Get-Content $path -Raw
  if ($content -match [regex]::Escape($new.Trim().Substring(0, [Math]::Min(40, $new.Trim().Length)))) {
    Write-Host "OK $label (ya aplicado)" -ForegroundColor DarkGreen
    return
  }
  if ($content -notmatch [regex]::Escape($old.Trim().Substring(0, [Math]::Min(40, $old.Trim().Length)))) {
    Write-Host "WARN $label (patrón no encontrado — revisar manualmente)" -ForegroundColor Yellow
    return
  }
  $content = $content.Replace($old, $new)
  Set-Content -Path $path -Value $content -NoNewline
  Write-Host "PATCH $label" -ForegroundColor Green
}

# 1) Agent mode en picker cuando @claude declara modes: agent
Patch-File "src\vs\workbench\contrib\chat\common\participants\chatAgents.ts" @'
				if (agent.id === 'chat.setup' || agent.id === 'github.copilot.editsAgent') {
					// TODO@roblourens firing the event below probably isn't necessary but leave it alone for now
					toolsAgentRegistered = true;
				} else {
'@ @'
				if (agent.id === 'chat.setup' || agent.id === 'github.copilot.editsAgent') {
					// TODO@roblourens firing the event below probably isn't necessary but leave it alone for now
					toolsAgentRegistered = true;
				} else if (agent.modes.includes(ChatModeKind.Agent)) {
					// EditCore: default @claude (and similar) participants expose Agent mode in the picker
					toolsAgentRegistered = true;
				} else {
'@ "hasToolsAgent para @claude"

Write-Host "`nParches de chat UI completados." -ForegroundColor Cyan
