import * as fs from "fs";
import * as path from "path";

const DOCS: Array<{ name: string; content: string }> = [
  {
    name: "EDITCORE_MARKETPLACE.md",
    content: `# EDITCORE Marketplace

## Visión

Marketplace interno de agentes IA, plantillas y conectores MCP integrado con el orquestador y el sistema de planes.

## Módulos

\`\`\`
marketplace/marketplaceService.ts   → catálogo bundled + remoto, install/uninstall
marketplace/marketplaceViewProvider.ts → panel sidebar
ecosystem/agentCatalog.ts           → catálogo unificado (builtin + marketplace + custom)
marketplace/catalog.json            → ítems bundled (v3)
\`\`\`

## Comandos

- \`editcore.ecosystem.openMarketplace\` / \`editcore.openMarketplace\`
- \`editcore.refreshMarketplace\`
- \`editcore.ecosystem.listAgents\`

## Planes

Los ítems tienen \`tier\`: free, pro, team, business, enterprise. Controlado por \`editcore.plan\` y \`org.json\`.

## Instalación

Los ítems se guardan en \`.editcore/marketplace/installed/\`. Agentes copian prompts a \`.editcore/agents/\`.
`,
  },
  {
    name: "EDITCORE_TEAM_SYSTEM.md",
    content: `# EDITCORE Team System

## Visión

Organizaciones colaborativas con miembros, roles, permisos y recursos compartidos.

## Módulos

\`\`\`
ecosystem/teamService.ts      → org.json, miembros, recursos compartidos
ecosystem/teamRoles.ts        → owner, admin, developer, reviewer, client, readonly
ecosystem/enterpriseSecurity.ts → assertOrgPermission, aislamiento org
\`\`\`

## Roles y permisos

| Rol | Permisos clave |
|-----|----------------|
| Owner | Todo |
| Admin | Usuarios, marketplace, APIs |
| Developer | Código, agentes, APIs |
| Reviewer | Ver, ejecutar agentes |
| Client | Ver proyectos |
| Readonly | Solo lectura |

## Comandos

- \`editcore.ecosystem.manageTeam\`
- \`editcore.initOrg\`

## Configuración

\`editcore.ecosystem.security.enabled\` — activa control RBAC por rol.
`,
  },
  {
    name: "EDITCORE_PLUGIN_ARCHITECTURE.md",
    content: `# EDITCORE Plugin Architecture

## Visión

Arquitectura extensible para herramientas, conectores e integraciones de terceros.

## Módulos

\`\`\`
ecosystem/pluginSdk.ts        → manifest, registro, documentación SDK v1
ecosystem/integrationHub.ts   → GitHub, GitLab, Vercel, Supabase, cloud
\`\`\`

## Manifest

Plugins en \`.editcore/plugins/{id}.json\`:

\`\`\`json
{
  "id": "my-connector",
  "name": "My Connector",
  "version": "1.0.0",
  "permissions": ["network", "filesystem"],
  "connectors": ["github"]
}
\`\`\`

## Comandos

- \`editcore.ecosystem.pluginSdk\`
- \`editcore.ecosystem.integrations\`
`,
  },
  {
    name: "EDITCORE_AGENT_BUILDER.md",
    content: `# EDITCORE Agent Builder

## Visión

Crear agentes personalizados sin programar: nombre, objetivo, modelo, herramientas, memoria e instrucciones.

## Módulos

\`\`\`
ecosystem/agentBuilder.ts     → wizard + persistencia
ecosystem/agentCatalog.ts     → @custom:{id} en chat
\`\`\`

## Almacenamiento

\`.editcore/agents/custom/{id}.json\` + \`{id}.md\`

## Uso en chat

\`\`\`
@custom:my-agent refactoriza el módulo de auth
\`\`\`

## Comandos

- \`editcore.ecosystem.agentBuilder\`
- \`editcore.ecosystem.listAgents\`
`,
  },
  {
    name: "EDITCORE_COLLABORATION_SYSTEM.md",
    content: `# EDITCORE Collaboration System

## Visión

Colaboración en proyectos: comentarios, actividad, notificaciones y versionado integrado con Git.

## Módulos

\`\`\`
ecosystem/collaborationService.ts → comentarios, actividad, notificaciones
ecosystem/versionControl.ts       → snapshots, diff, historial git
ecosystem/aiHub.ts                  → prompts, agentes, plantillas compartidos
\`\`\`

## Comandos

- \`editcore.ecosystem.addComment\`
- \`editcore.ecosystem.activity\`
- \`editcore.ecosystem.snapshot\`
- \`editcore.ecosystem.versions\`
- \`editcore.ecosystem.openAiHub\`
- \`editcore.ecosystem.saveToHub\`
- \`editcore.ecosystem.searchHub\`
- \`editcore.ecosystem.analytics\`
`,
  },
];

export async function writeEcosystemDocumentation(root: string): Promise<string[]> {
  const written: string[] = [];
  for (const dir of [path.join(root, ".editcore", "docs"), path.join(root, "docs")]) {
    await fs.promises.mkdir(dir, { recursive: true });
    for (const doc of DOCS) {
      const fp = path.join(dir, doc.name);
      await fs.promises.writeFile(fp, doc.content + "\n", "utf8");
      if (!written.includes(fp)) written.push(fp);
    }
  }
  return written;
}
