import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type AgentRoleId =
  | 'default'
  | 'architect'
  | 'fullstack'
  | 'devops'
  | 'qa'
  | 'gps'
  | 'founder'
  | 'cto'
  | 'saas';

export interface AgentRole {
  id: AgentRoleId;
  label: string;
  systemPrompt: string;
}

export const AGENT_ROLES: Record<AgentRoleId, AgentRole> = {
  default: {
    id: 'default',
    label: 'General',
    systemPrompt: '',
  },
  architect: {
    id: 'architect',
    label: 'Arquitecto',
    systemPrompt: `Rol: Arquitecto de Software de EditCore.
- Priorizá diseño, módulos, interfaces y deuda técnica.
- Documentá decisiones (ADR breve) cuando propongas cambios estructurales.
- Antes de código, explicá trade-offs y dependencias entre componentes.
- Evitá sobre-ingeniería; favorecé cambios incrementales.`,
  },
  fullstack: {
    id: 'fullstack',
    label: 'Full Stack',
    systemPrompt: `Rol: Desarrollador Full Stack de EditCore.
- Implementá features end-to-end (UI, API, datos) con cambios mínimos y testeables.
- Preferí apply_patch; mantené consistencia con el estilo del repo.
- Verificá tipos, imports y rutas antes de escribir.`,
  },
  devops: {
    id: 'devops',
    label: 'DevOps',
    systemPrompt: `Rol: DevOps de EditCore.
- Enfocate en CI/CD, Docker, deploy, scripts, variables de entorno y seguridad operativa.
- Usá run_command y git_* con precaución; explicá cada comando.
- Integrá con Vercel/Supabase/GitHub cuando aplique.`,
  },
  qa: {
    id: 'qa',
    label: 'QA',
    systemPrompt: `Rol: QA / Tester de EditCore.
- Buscá bugs, casos borde, regresiones y falta de tests.
- Proponé y ejecutá tests (npm test, etc.) con aprobación del usuario.
- Reportá hallazgos con pasos de reproducción claros.`,
  },
  gps: {
    id: 'gps',
    label: 'GPS / Flotas',
    systemPrompt: `Rol: Experto GPS y telemetría de EditCore.
- Hardware Teltonika, protocolos Codec8, ingesta TCP/UDP, geocercas, alertas y flotas.
- Proponé arquitectura por capas: dispositivo → ingesta → procesamiento → API → UI.`,
  },
  founder: {
    id: 'founder',
    label: 'Fundador',
    systemPrompt: `Rol: Modo Fundador de EditCore.
- Idea → MVP, mercado, modelo de negocio, roadmap y costos.
- Priorizá validación sobre perfección técnica; sé directo y accionable.`,
  },
  cto: {
    id: 'cto',
    label: 'CTO',
    systemPrompt: `Rol: CTO de EditCore.
- Evaluá escalabilidad, costos, seguridad, deuda técnica y roadmap ejecutivo.
- Trade-offs claros para decisiones de arquitectura y equipo.`,
  },
  saas: {
    id: 'saas',
    label: 'SaaS Builder',
    systemPrompt: `Rol: SaaS Builder de EditCore.
- Auth, roles, multi-tenant, billing, API REST/GraphQL, frontend y deploy.
- MVP SaaS en capas con buenas prácticas de seguridad y observabilidad.`,
  },
};

const ROLE_MENTION =
  /^@(architect|fullstack|devops|qa|gps|founder|cto|saas)\b\s*/i;

export function detectRoleFromPrompt(prompt: string): { role: AgentRoleId; cleanPrompt: string } {
  const match = prompt.match(ROLE_MENTION);
  if (!match) {
    return { role: 'default', cleanPrompt: prompt };
  }
  const role = match[1].toLowerCase() as AgentRoleId;
  return { role, cleanPrompt: prompt.slice(match[0].length).trim() };
}

export async function loadInstalledMarketplacePrompt(roleId: AgentRoleId): Promise<string | undefined> {
  if (roleId === 'default') {
    return undefined;
  }
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }

  const installedDir = path.join(root, '.editcore', 'marketplace', 'installed');
  const agentsDir = path.join(root, '.editcore', 'agents');
  try {
    const files = await fs.promises.readdir(installedDir);
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      const raw = await fs.promises.readFile(path.join(installedDir, f), 'utf8');
      const manifest = JSON.parse(raw) as { role?: string; id?: string };
      if (manifest.role !== roleId || !manifest.id) {
        continue;
      }
      const promptPath = path.join(agentsDir, `${manifest.id}.md`);
      try {
        const content = (await fs.promises.readFile(promptPath, 'utf8')).trim();
        if (content) {
          return content;
        }
      } catch {
        // sin prompt instalado
      }
    }
  } catch {
    // sin marketplace instalado
  }
  return undefined;
}

export async function buildSystemPrompt(base: string, roleId: AgentRoleId): Promise<string> {
  const role = AGENT_ROLES[roleId] ?? AGENT_ROLES.default;
  const installed = await loadInstalledMarketplacePrompt(roleId);
  const roleBlock = installed ?? role.systemPrompt;
  if (!roleBlock) {
    return base;
  }
  return `${base}\n\n---\n${roleBlock}`;
}
