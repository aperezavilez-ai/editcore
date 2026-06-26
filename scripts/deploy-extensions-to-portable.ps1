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
  if (Test-Path "out") { Remove-Item "out" -Recurse -Force }
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

$patchProduct = Join-Path $Root "scripts\patch-portable-product-chat.js"
if (Test-Path $patchProduct) {
  node $patchProduct
}

$patchOnboarding = Join-Path $Root "scripts\patch-portable-onboarding-stub.js"
if (Test-Path $patchOnboarding) {
  node $patchOnboarding
}

$patchChatEnable = Join-Path $Root "scripts\patch-portable-chat-enablement.js"
if (Test-Path $patchChatEnable) {
  node $patchChatEnable
}

$forceClaudeStartup = Join-Path $Root "scripts\patch-portable-force-editcore-claude-startup.js"
if (Test-Path $forceClaudeStartup) {
  node $forceClaudeStartup
}

$fixChatDisabled = Join-Path $Root "scripts\patch-portable-fix-chat-setup-disabled.js"
if (Test-Path $fixChatDisabled) {
  node $fixChatDisabled
}

$alwaysLoadClaude = Join-Path $Root "scripts\patch-portable-always-load-editcore-claude.js"
if (Test-Path $alwaysLoadClaude) {
  node $alwaysLoadClaude
}

$cleanChatUi = Join-Path $Root "scripts\patch-portable-chat-clean-ui.js"
if (Test-Path $cleanChatUi) {
  node $cleanChatUi
}
$cursorChatUi = Join-Path $Root "scripts\patch-portable-chat-cursor-ui.js"
if (Test-Path $cursorChatUi) {
  node $cursorChatUi
}
$blockChatEditor = Join-Path $Root "scripts\patch-portable-chat-block-editor.js"
if (Test-Path $blockChatEditor) {
  node $blockChatEditor
}

$modelPicker = Join-Path $Root "scripts\patch-portable-chat-model-picker.js"
if (Test-Path $modelPicker) {
  node $modelPicker
}

$lmResolve = Join-Path $Root "scripts\patch-portable-lm-resolve-on-register.js"
if (Test-Path $lmResolve) {
  node $lmResolve
}

$chatInstant = Join-Path $Root "scripts\patch-portable-chat-instant-ready.js"
if (Test-Path $chatInstant) {
  node $chatInstant
}

$lmGroups = Join-Path $Root "scripts\patch-portable-fix-editcore-lm-groups.js"
if (Test-Path $lmGroups) {
  node $lmGroups
}

$chatBrowserCtx = Join-Path $Root "scripts\patch-portable-chat-browser-context.js"
if (Test-Path $chatBrowserCtx) {
  node $chatBrowserCtx
}

$browserTitlebar = Join-Path $Root "scripts\patch-portable-browser-titlebar.js"
if (Test-Path $browserTitlebar) {
  node $browserTitlebar
}
$watermarkBrowser = Join-Path $Root "scripts\patch-portable-editor-watermark-browser.js"
if (Test-Path $watermarkBrowser) {
  node $watermarkBrowser
}

$removeGptpro4all = Join-Path $Root "scripts\patch-portable-remove-gptpro4all.js"
if (Test-Path $removeGptpro4all) {
  node $removeGptpro4all
}

$skipCopilotSetup = Join-Path $Root "scripts\patch-portable-skip-copilot-chat-setup.js"
if (Test-Path $skipCopilotSetup) {
  node $skipCopilotSetup
}

$fixStartup = Join-Path $Root "scripts\fix-startup-settings.js"
if (Test-Path $fixStartup) {
  node $fixStartup
}

$fixWorkspaceUi = Join-Path $Root "scripts\fix-workspace-ui-settings.js"
if (Test-Path $fixWorkspaceUi) {
  node $fixWorkspaceUi
}

$enableClaude = Join-Path $Root "scripts\enable-editcore-claude.js"
if (Test-Path $enableClaude) {
  node $enableClaude
}

$clearCache = Join-Path $Root "scripts\clear-editcore-chat-model-cache.js"
if (Test-Path $clearCache) {
  Write-Host "Limpiando cache de modelos obsoletos..." -ForegroundColor Yellow
  node $clearCache
}

$fixLmProfile = Join-Path $Root "scripts\fix-editcore-language-models-profile.js"
if (Test-Path $fixLmProfile) {
  node $fixLmProfile
}

$purgeGptpro4all = Join-Path $Root "scripts\purge-gptpro4all-user-data.js"
if (Test-Path $purgeGptpro4all) {
  node $purgeGptpro4all
}

$applySettings = Join-Path $Root "scripts\apply-portable-user-settings.js"
if (Test-Path $applySettings) {
  node $applySettings
}

$applyArgv = Join-Path $Root "scripts\apply-portable-argv.js"
if (Test-Path $applyArgv) {
  node $applyArgv
}

Write-Host ""
Write-Host "Deploy completo. Abre VSCode-win32-x64\EditCore.exe y recarga (Ctrl+Alt+R)." -ForegroundColor Cyan
