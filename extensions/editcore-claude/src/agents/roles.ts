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
  | 'security';

export interface AgentRole {
  id: AgentRoleId;
  label: string;
  systemPrompt: string;
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
};

const ROLE_MENTION =
  /^@(architect|fullstack|devops|qa|gps|founder|cto|saas|security)\b\s*/i;

export function detectRoleFromPrompt(prompt: string): { role: AgentRoleId; cleanPrompt: string } {
  const match = prompt.match(ROLE_MENTION);
  if (!match) {
    return { role: 'default', cleanPrompt: prompt };
  }
  const role = match[1].toLowerCase() as AgentRoleId;
  return { role, cleanPrompt: prompt.slice(match[0].length).trim() };
}

export async function buildSystemPrompt(base: string, roleId: AgentRoleId): Promise<string> {
  const role = AGENT_ROLES[roleId] ?? AGENT_ROLES.default;
  if (!role.systemPrompt) {
    return base;
  }
  return `${base}\n\n---\n${role.systemPrompt}`;
}
