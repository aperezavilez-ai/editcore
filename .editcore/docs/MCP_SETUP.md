# MCP Setup — EditCore

_Configurado en Prompt 7 de 21_

## Servidores incluidos

| ID | Nombre | Estado | Descripción |
|----|--------|--------|-------------|
| `filesystem` | EditCore Filesystem MCP | ✅ Activo | Lectura/escritura de archivos del workspace |
| `git` | EditCore Git MCP | ✅ Disponible | Operaciones Git desde el agente |
| `qdrant` | Qdrant Vector DB MCP | ⚪ Opcional | Búsqueda vectorial cuando Qdrant está corriendo |

## Cómo agregar un servidor MCP

Edita `.editcore/mcp.json` y agrega una entrada al array `servers`:

```json
{
  "id": "mi-servidor",
  "name": "Nombre descriptivo",
  "description": "Qué hace este servidor",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@paquete/mcp-server"],
  "enabled": true,
  "autoStart": true,
  "capabilities": ["tool1", "tool2"]
}
```

### Transportes soportados

- `stdio` — Proceso local (más común). Requiere `command` + `args`.
- `http` — Servidor remoto. Requiere `url`.
- `sse` — Server-Sent Events. Requiere `url`.

## Activar Qdrant (opcional pero recomendado)

Para búsqueda vectorial real:

```bash
# Docker
docker run -p 6333:6333 qdrant/qdrant

# O descarga binario desde https://qdrant.tech
```

Una vez corriendo, cambia `"enabled": true` en el servidor `qdrant` del mcp.json  
y ejecuta el comando `EditCore: Indexar workspace en Vector Engine`.

## Comandos disponibles

- `EditCore: Indexar workspace en Vector Engine` → Re-indexa con Qdrant o TF-IDF local
- `EditCore: Verificar estado Qdrant` → Chequea si Qdrant está disponible en el puerto 6333
- `editcore.autonomy.diagnose` → Diagnóstico completo incluyendo estado MCP

## Servidores MCP recomendados para desarrollo

```bash
# Búsqueda en web (opcional, requiere API key)
npx -y @modelcontextprotocol/server-brave-search

# Base de datos PostgreSQL
npx -y @modelcontextprotocol/server-postgres

# GitHub
npx -y @modelcontextprotocol/server-github
```
