# EDITCORE Plugin Architecture

## Visión

Arquitectura extensible para herramientas, conectores e integraciones de terceros.

## Módulos

```
ecosystem/pluginSdk.ts        → manifest, registro, documentación SDK v1
ecosystem/integrationHub.ts   → GitHub, GitLab, Vercel, Supabase, cloud
```

## Manifest

Plugins en `.editcore/plugins/{id}.json`:

```json
{
  "id": "my-connector",
  "name": "My Connector",
  "version": "1.0.0",
  "permissions": ["network", "filesystem"],
  "connectors": ["github"]
}
```

## Comandos

- `editcore.ecosystem.pluginSdk`
- `editcore.ecosystem.integrations`

