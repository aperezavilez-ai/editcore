# EDITCORE Marketplace

## Visión

Marketplace interno de agentes IA, plantillas y conectores MCP integrado con el orquestador y el sistema de planes.

## Módulos

```
marketplace/marketplaceService.ts   → catálogo bundled + remoto, install/uninstall
marketplace/marketplaceViewProvider.ts → panel sidebar
ecosystem/agentCatalog.ts           → catálogo unificado (builtin + marketplace + custom)
marketplace/catalog.json            → ítems bundled (v3)
```

## Comandos

- `editcore.ecosystem.openMarketplace` / `editcore.openMarketplace`
- `editcore.refreshMarketplace`
- `editcore.ecosystem.listAgents`

## Planes

Los ítems tienen `tier`: free, pro, team, business, enterprise. Controlado por `editcore.plan` y `org.json`.

## Instalación

Los ítems se guardan en `.editcore/marketplace/installed/`. Agentes copian prompts a `.editcore/agents/`.

