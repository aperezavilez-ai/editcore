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
  | 'saas'
  | 'security'
  | 'ui-design'
  | 'billing'
  | string;

export interface AgentRole {
  id: AgentRoleId;
  label: string;
  systemPrompt: string;
  /** Si se define, el agente solo puede usar estas tools (por nombre). Si está vacío/undefined, usa todas. */
  allowedTools?: string[];
}

/** Habilidades del agente incluidas en EditCore (sin instalar desde Marketplace). */
export const AGENT_ROLES: Record<AgentRoleId, AgentRole> = {
  default: {
    id: 'default',
    label: 'General',
    systemPrompt: '',
  },
  architect: {
    id: 'architect',
    label: 'Arquitecto Pro',
    systemPrompt: `Rol: Arquitecto de Software de EditCore.
- Mantené un mapa mental de módulos y dependencias.
- Priorizá diseño, módulos, interfaces y deuda técnica.
- Antes de cambios grandes, proponé ADR en .editcore/adrs/.
- Usá twin_query y analyze_impact obligatoriamente en refactors.
- Documentá decisiones, riesgos y plan de reversión.
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
    label: 'GPS / Flotas Expert',
    systemPrompt: `Rol: Experto GPS y telemetría de EditCore.
- Hardware: Teltonika (FMB, FMC), protocolos Codec8/Codec8Extended, AVL.
- Backend: ingesta TCP/UDP, parsers, colas, timeseries (Postgres/Timescale, Influx).
- Mapas: geocercas, rutas, clustering, tiles (Mapbox/Leaflet).
- Alertas: velocidad, ignición, pánico, desconexión, batería.
- Flotas: grupos, conductores, mantenimiento, eSIM/APN.
- Integraciones: APIs de monitoreo, webhooks, SMS/email.
- Proponé arquitectura por capas: dispositivo → ingesta → procesamiento → API → UI.`,
  },
  founder: {
    id: 'founder',
    label: 'Modo Fundador',
    systemPrompt: `Rol: Modo Fundador de EditCore (cofundador técnico + estratega de producto).
1. Idea → MVP: define el mínimo viable en 2-4 semanas.
2. Mercado: competidores, diferenciación, ICP (cliente ideal).
3. Modelo de negocio: pricing, unit economics, CAC/LTV orientativo.
4. Roadmap: fases con hitos medibles.
5. Costos: infra, APIs, equipo — estimación orden de magnitud.
6. Go-to-market: canales, primeros 10 clientes.
Sé directo; priorizá validación sobre perfección técnica.`,
  },
  cto: {
    id: 'cto',
    label: 'CTO / Compliance',
    systemPrompt: `Rol: CTO de EditCore.
- Evaluá escalabilidad, costos, seguridad, deuda técnica y roadmap ejecutivo.
- Trade-offs claros para decisiones de arquitectura y equipo.
- Cumplimiento y trazabilidad (SOC2-lite, GDPR orientativo).
- Documentá controles, retención de datos, audit trail.
- Sugerí políticas en .editcore/ y ADRs con write_adr.
- Separá PII, logs, backups y acceso por rol.`,
  },
  saas: {
    id: 'saas',
    label: 'SaaS Builder',
    systemPrompt: `Rol: SaaS Builder de EditCore.
- Auth, roles, multi-tenant, billing, API REST/GraphQL, frontend y deploy.
- MVP SaaS en capas con buenas prácticas de seguridad y observabilidad.
- Monorepo típico: API Fastify + React/Vite + Docker Postgres.`,
  },
  security: {
    id: 'security',
    label: 'Security Expert',
    systemPrompt: `Rol: Security Expert de EditCore.
- OWASP Top 10, secretos, auth, RBAC, rate limits.
- Revisá dependencias, headers, CORS, SQLi, XSS, SSRF.
- Proponé hardening incremental con checklist accionable.
- Usá analyze_impact antes de cambios en auth o permisos.`,
  },
  'ui-design': {
    id: 'ui-design',
    label: 'UI Design',
    systemPrompt: `Rol: Diseñador de UI de EditCore.
- No generás imágenes ni mockups visuales: generás código real (HTML/CSS/JSX/TSX)
  que el usuario puede previsualizar ejecutando el proyecto.
- Priorizá accesibilidad (contraste, foco, aria-*), responsive y consistencia
  de espaciado/tipografía.
- Si el proyecto ya usa una librería de UI (Tailwind, MUI, shadcn, etc.), seguí
  sus convenciones en vez de imponer una nueva.
- Aclará siempre que el resultado es código, no un diseño gráfico, y que el
  usuario debe correr el proyecto para verlo.`,
  },
  billing: {
    id: 'billing',
    label: 'Billing / Pagos',
    systemPrompt: `Rol: Especialista en cobros e integraciones de pago de EditCore.
- Generás código de integración real (Stripe, Mercado Pago, etc.) cuando el
  usuario lo pide: checkout, webhooks, manejo de suscripciones.
- NUNCA simulás ni inventás que un pago fue procesado: todo cobro real requiere
  que el usuario tenga su propia cuenta y credenciales con el proveedor.
- Recordá siempre validar firmas de webhooks y manejar idempotencia.
- No generes claves de API ni secretos falsos; usá variables de entorno
  (.env.example) para que el usuario las complete con las suyas.`,
  },
};

interface CustomAgentFile {
  id: string;
  label: string;
  systemPrompt: string;
  allowedTools?: string[];
}

let customAgentsCache: Record<string, AgentRole> = {};

function getAgentsFilePath(): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return path.join(root, '.editcore', 'agents.json');
}

/**
 * Agentes definidos por el usuario en .editcore/agents.json (id, label, systemPrompt,
 * allowedTools opcional). Si allowedTools está definido, se filtran las tools que se
 * envían a la API para ese agente (enforcement real: el modelo no puede llamar una
 * tool que no está en la lista que se le envía). Las aprobaciones manuales de
 * write_file/run_command siguen aplicando igual sobre las tools permitidas.
 */
export async function loadCustomAgents(): Promise<Record<string, AgentRole>> {
  const filePath = getAgentsFilePath();
  if (!filePath) {
    customAgentsCache = {};
    return customAgentsCache;
  }
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CustomAgentFile[];
    const result: Record<string, AgentRole> = {};
    for (const entry of parsed) {
      if (!entry?.id || !entry?.systemPrompt) continue;
      result[entry.id] = {
        id: entry.id,
        label: entry.label || entry.id,
        systemPrompt: entry.systemPrompt,
        allowedTools: Array.isArray(entry.allowedTools) && entry.allowedTools.length > 0 ? entry.allowedTools : undefined,
      };
    }
    customAgentsCache = result;
  } catch {
    customAgentsCache = {};
  }
  return customAgentsCache;
}

export function getCustomAgentsSync(): Record<string, AgentRole> {
  return customAgentsCache;
}

export async function saveCustomAgent(agent: CustomAgentFile): Promise<void> {
  const filePath = getAgentsFilePath();
  if (!filePath) {
    throw new Error('Abre un workspace primero.');
  }
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  let existing: CustomAgentFile[] = [];
  try {
    existing = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch {
    existing = [];
  }
  const next = existing.filter((a) => a.id !== agent.id);
  next.push(agent);
  await fs.promises.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  await loadCustomAgents();
}

function resolveRole(roleId: AgentRoleId): AgentRole | undefined {
  return AGENT_ROLES[roleId as string] ?? customAgentsCache[roleId as string];
}

/** Tools permitidas para un rol/agente, o undefined si puede usar todas (comportamiento por defecto). */
export function getAllowedToolsForRole(roleId: AgentRoleId): string[] | undefined {
  return resolveRole(roleId)?.allowedTools;
}

const BUILTIN_ROLE_IDS = 'architect|fullstack|devops|qa|gps|founder|cto|saas|security|ui-design|billing';

export function detectRoleFromPrompt(prompt: string): { role: AgentRoleId; cleanPrompt: string } {
  const customIds = Object.keys(customAgentsCache).map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = [BUILTIN_ROLE_IDS, ...customIds].join('|');
  const mention = new RegExp(`^@(${pattern})\\b\\s*`, 'i');
  const match = prompt.match(mention);
  if (!match) {
    return { role: 'default', cleanPrompt: prompt };
  }
  const role = match[1].toLowerCase();
  return { role, cleanPrompt: prompt.slice(match[0].length).trim() };
}

export async function buildSystemPrompt(base: string, roleId: AgentRoleId): Promise<string> {
  const role = resolveRole(roleId) ?? AGENT_ROLES.default;
  if (!role.systemPrompt) {
    return base;
  }
  return `${base}\n\n---\n${role.systemPrompt}`;
}
