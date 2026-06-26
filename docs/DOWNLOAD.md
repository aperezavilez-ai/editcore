# Descargar EditCore IDE

EditCore es un editor de escritorio para Windows (x64). No requiere instalar VS Code ni extensiones por separado.

## Requisitos

- Windows 10 u 11 (64 bits)
- Conexión a internet (APIs de Claude/OpenAI, GitHub, Vercel, Supabase)
- Tu propia API key de Anthropic u OpenAI (configuración en el primer arranque)

## Opción A — Instalador (recomendado)

1. Abrí [Releases](https://github.com/aperezavilez-ai/editcore/releases)
2. Descargá `EditCore-x.x.x-win32-x64-setup.exe`
3. Ejecutá el instalador  
   - Si Windows muestra “publicador desconocido”: **Más información** → **Ejecutar de todas formas**  
   - La firma de código comercial se añadirá en una fase posterior
4. Abrí **EditCore IDE** desde el menú Inicio

## Opción B — Portable (ZIP)

1. Descargá `EditCore-x.x.x-win32-x64-portable.zip`
2. Descomprimí en una ruta **sin espacios** (ej. `D:\EditCore`)
3. Ejecutá `EditCore.exe`

## Verificar integridad

En cada release encontrás `SHA256SUMS.txt`. En PowerShell:

```powershell
Get-FileHash .\EditCore-1.0.0-win32-x64-setup.exe -Algorithm SHA256
```

Compará con el hash publicado.

## Primer arranque

1. Tour de configuración (opcional)
2. **Configurar API Keys** — Anthropic u OpenAI
3. **EditCore Connect** — Vercel, Supabase, GitHub (opcional)
4. **Edición comunidad** — gratuita al descargar; licencias de pago más adelante

## Actualizaciones

- Menú de comandos (`Ctrl+Shift+P`): **EditCore: Buscar actualizaciones**
- Pantalla de inicio → **Buscar actualizaciones**
- El instalador futuro usará el canal `releases/update` de GitHub

## Soporte

- [Reportar problema](https://github.com/aperezavilez-ai/editcore/issues/new)
- [Estado del producto](command:editcore.productHealth) dentro del IDE

## Para mantenedores — crear un release

```powershell
# 1. Build completo (una vez): build-editcore.ps1 + build-win-installer.ps1
# 2. Empaquetar:
powershell -ExecutionPolicy Bypass -File scripts\package-release.ps1
# 3. Publicar:
gh release create v1.0.0 dist/* --title "EditCore 1.0.0" --notes-file dist/RELEASE_NOTES.txt
git add releases/latest.json releases/update/
git commit -m "Release 1.0.0 manifests"
git push
```

## Precios

La facturación y planes de pago se configurarán en una fase posterior. La descarga actual es **edición comunidad** con todas las funciones del IDE.
