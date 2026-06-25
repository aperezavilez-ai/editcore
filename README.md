# EditCore IDE

Editor de escritorio basado en **Code-OSS** (la base open source de VS Code)
con **Claude (Anthropic)** integrado de fábrica — sin necesidad de instalar
ninguna extensión por separado.

```
editcore/
├── LICENSE.txt                ← Licencia MIT del código propio de EditCore
├── branding/
│   ├── product.json          ← Identidad de EditCore + lista de extensiones built-in
│   └── icons/                ← Ícono de la app por plataforma (Windows ya listo)
│       ├── win32/code.ico
│       ├── darwin/code.iconset/   (falta compilar a .icns en una Mac)
│       └── linux/code.png
├── extensions/
│   ├── editcore-claude/        ← Chat con Claude (Anthropic)
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── anthropicClient.ts
│   │   │   └── chatViewProvider.ts
│   │   ├── media/editcore-icon.svg
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── editcore-connect/       ← Panel unificado: Vercel + Supabase + estado de Git/GitHub
│       ├── src/
│       │   ├── extension.ts
│       │   └── connectPanelProvider.ts
│       ├── media/connect-icon.svg
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   └── build-editcore.ps1     ← Automatiza TODO el proceso (8 pasos)
└── docs/
    └── (este README y notas adicionales)
```

---

## Qué hace este proyecto

1. **Clona** el repositorio oficial `microsoft/vscode` (Code-OSS, MIT license)
2. **Reemplaza** su `product.json` con la identidad de EditCore — nombre,
   ícono, protocolo de URL (`editcore://`), bundle ID, todo
3. **Inyecta** dos extensiones propias como *built-in*:
   - `editcore-claude` — chat con Claude, explicar/corregir código
   - `editcore-connect` — panel unificado de Vercel + Supabase + estado de Git/GitHub
4. **Inyecta** las extensiones oficiales de GitHub (Pull Requests, Issues,
   autenticación) — las mismas que usa VS Code real
5. **Instala** las CLIs de Vercel, Supabase y GitHub de forma global en el
   sistema, listas para usarse desde la terminal integrada
6. **Compila** todo en un ejecutable de escritorio nativo (Electron)

## Qué conecta cada pieza

| Servicio | Cómo se conecta | Dónde vive el token |
|---|---|---|
| **Anthropic (Claude)** | SDK oficial, llamadas directas a `api.anthropic.com` | `vscode.SecretStorage` (cifrado por el OS) |
| **GitHub** | Extensión oficial de Microsoft + GitHub CLI (`gh`) | Sesión nativa de VS Code (OAuth del propio GitHub) |
| **Vercel** | Vercel CLI (`vercel`) ejecutada desde terminal integrada, token guardado de forma segura | `vscode.SecretStorage` |
| **Supabase** | Supabase CLI (`supabase`) ejecutada desde terminal integrada, token guardado de forma segura | `vscode.SecretStorage` |

Ninguno de estos tokens se envía a servidores de EditCore — cada uno habla
directo con su proveedor (Anthropic, Vercel, Supabase, GitHub).

## Cómo construirlo

### ⚠️ IMPORTANTE: usa una ruta SIN ESPACIOS

Descomprime y coloca esta carpeta en una ruta que **no tenga espacios**,
por ejemplo `D:\EditCore` — nunca algo como `D:\Mis Programas\EditCore`
o `D:\PROGRAMAS IA\EditCore`. Una herramienta interna de Code-OSS
(`tsgo`) tiene un bug real con rutas que contienen espacios y rompe
la compilación de forma muy confusa (el script ya valida esto y se
detiene con un mensaje claro si lo detecta).

### Requisitos (instalar antes de correr el script)

| Herramienta | Versión | Link |
|---|---|---|
| Node.js | 18.x | https://nodejs.org/dist/latest-v18.x/ |
| Python | 3.x | https://www.python.org/downloads/ |
| Git | cualquiera reciente | https://git-scm.com/download/win |
| Visual Studio Build Tools 2022 | con "Desktop development with C++" | https://visualstudio.microsoft.com/downloads/ |

### Ejecutar el build automatizado

```powershell
cd editcore
powershell -ExecutionPolicy Bypass -File scripts\build-editcore.ps1
```

El script:
1. Verifica que la ruta no tenga espacios
2. Verifica que tengas Node, npm, Python y Git instalados
3. Clona Code-OSS en `editcore-src/`
4. Copia tu `product.json` de branding y aplica el ícono de Windows
5. Copia e instala las extensiones `editcore-claude` y `editcore-connect`
6. Quita extensiones de fábrica con bugs de compilación conocidos
   (`copilot`, `mermaid-markdown-features`) y limpia sus referencias
7. Corrige un bug real de la herramienta `tsgo`
8. Corrige el script `compile` de Code-OSS
9. Instala las CLIs de Vercel, Supabase y GitHub si te faltan
10. Instala las dependencias de todas las extensiones de fábrica
11. Instala las dependencias del editor completo y compila

**Tiempo estimado: 45-90 minutos** la primera vez (la mayoría es
descarga + compilación de Code-OSS, no de tu extensión).

### Ejecutar en modo desarrollo

```powershell
cd editcore-src
.\scripts\code.bat
```

Esto abre EditCore IDE con el chat de Claude ya visible en la barra
de actividad lateral (ícono de EditCore).

### Generar el instalador final (.exe)

```powershell
cd editcore-src
npm run gulp vscode-win32-x64
```

El ejecutable final queda en `../EditCore-win32-x64/`.

---

## Configurar tus cuentas por primera vez

Abre EditCore IDE y ve al ícono **"EditCore Connect"** en la barra de
actividad lateral (el de los 4 círculos conectados). Ahí verás el
estado de cada herramienta y botones para configurar cada una:

### Claude (Anthropic)
1. `Ctrl+Shift+P` → **"EditCore: Configurar API Key de Anthropic"**
2. Pega tu key de https://console.anthropic.com
3. Clic en el ícono de EditCore (lateral) → empieza a chatear

### GitHub
1. Clic en el ícono de cuenta (esquina inferior izquierda del editor)
2. **"Sign in with GitHub"** → se abre el navegador → autoriza
3. Ya puedes clonar, hacer push/pull, y gestionar Pull Requests
   visualmente desde el panel de Source Control

### Vercel
1. Genera un token en https://vercel.com/account/tokens
2. En el panel "EditCore Connect" → **"Configurar token"** (sección Vercel)
3. Pégalo → botón **"Deploy a Vercel"** queda activo
4. Cada deploy corre `vercel --yes` en una terminal dedicada

### Supabase
1. Genera un token en https://supabase.com/dashboard/account/tokens
2. En el panel "EditCore Connect" → **"Configurar token"** (sección Supabase)
3. Pégalo → botón **"Vincular proyecto"** queda activo
4. Esto corre `supabase login` + `supabase link` en una terminal dedicada

Todos los tokens se guardan cifrados con `vscode.SecretStorage`
(Keychain en macOS, Credential Manager en Windows, libsecret en Linux) —
nunca en texto plano, nunca en `settings.json`.

---

## Qué funciona ya (heredado de Code-OSS, sin tocar nada)

Como este proyecto es un fork real de VS Code, **todo lo que ya funciona
en VS Code funciona aquí sin cambios**:

- Explorador de archivos completo
- Terminal integrada (PowerShell, bash, cmd)
- Git integrado (commits, branches, diff visual)
- Soporte de extensiones — pueden instalarse desde Open VSX (ver nota abajo)
- IntelliSense / LSP para decenas de lenguajes
- Debugging integrado
- Multi-cursor, búsqueda global, snippets, todo

## Qué agrega EditCore sobre la base

- Panel de chat con Claude integrado de fábrica (no hay que instalarlo)
- Menú contextual: clic derecho en código seleccionado →
  "EditCore: Explicar selección" / "EditCore: Corregir selección"
- Inserción de código generado directamente en el cursor activo
- Modelo y límite de tokens configurables desde Settings

---

## Nota legal importante sobre el Marketplace

VS Code apunta por defecto al *Visual Studio Marketplace*, que es
**propiedad de Microsoft** y su licencia de uso prohíbe usarlo desde
forks no oficiales. Por eso `product.json` en este proyecto apunta a
**Open VSX** (`open-vsx.org`) en su lugar — es una alternativa abierta
y gratuita mantenida por la Eclipse Foundation, totalmente legal para
usar en cualquier fork. Cursor, VSCodium, Theia y otros forks ya hacen
esto mismo.

---

## Decisiones de este proyecto (uso personal)

Este fork está pensado para **uso personal, no para distribuir a otros
usuarios**. Eso simplifica varias cosas que un producto público sí
necesitaría:

- **Claude**: tú pones tu propia API key de Anthropic (`Ctrl+Shift+P` →
  "EditCore: Configurar API Key de Anthropic"). No hay facturación ni
  key compartida — pagas directo a Anthropic según tu uso.
- **Sin sincronización con ningún servidor propio** — no existe
  "editcore.com"; todo vive en tu máquina y habla directo con
  Anthropic / Vercel / Supabase / GitHub.
- **Sin auto-actualización** — cuando quieras una versión nueva,
  vuelves a correr `build-editcore.ps1` (o `git pull` en
  `editcore-src/` + recompilar).
- **Sin firma de código** — al ser solo para ti, el aviso de
  "publicador desconocido" de Windows no es un problema real; solo
  haz clic en "More info" → "Run anyway" la primera vez que abras el
  instalador.
- **Sin distribución** — el `.exe` que genera el script se queda en
  tu máquina; no hay que publicarlo en ningún lado.

Si en algún momento decides compartir EditCore con más gente, estos
puntos (firma de código, billing compartido, auto-update) son los que
habría que retomar.

