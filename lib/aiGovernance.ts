/**
 * AI Governance System — valida si una acción de un agente está permitida
 * según las reglas de gobernanza y el nivel de autonomía activo.
 *
 * Las reglas base están en la tabla ai_governance_rules (migración 0009).
 * Este módulo aplica las reglas en memoria para decisiones síncronas;
 * para auditoría completa se recomienda consultar la tabla.
 */

export type ActionType =
  | "read_files"
  | "write_files"
  | "git_commit"
  | "deploy"
  | "delete_data"
  | "modify_secrets"
  | "api_call"
  | "create_agent"
  | "send_message"
  | "access_billing";

export interface GovernanceResult {
  allowed: boolean;
  requires_human_approval: boolean;
  reason: string;
  autonomy_level_required: number;
}

interface Rule {
  allowed: boolean;
  requires_approval: boolean;
  min_autonomy_level: number;
  description: string;
}

const BASE_RULES: Record<ActionType, Rule> = {
  read_files:      { allowed: true,  requires_approval: false, min_autonomy_level: 1, description: "Lectura siempre permitida." },
  write_files:     { allowed: true,  requires_approval: true,  min_autonomy_level: 3, description: "Escritura requiere aprobación humana hasta nivel 4." },
  git_commit:      { allowed: true,  requires_approval: true,  min_autonomy_level: 4, description: "Commits siempre requieren aprobación humana." },
  deploy:          { allowed: true,  requires_approval: true,  min_autonomy_level: 4, description: "Deploy siempre requiere aprobación humana." },
  delete_data:     { allowed: false, requires_approval: true,  min_autonomy_level: 5, description: "Eliminar datos prohibido en autonomía < 5." },
  modify_secrets:  { allowed: false, requires_approval: false, min_autonomy_level: 99, description: "Modificar secrets nunca permitido autónomamente." },
  api_call:        { allowed: true,  requires_approval: false, min_autonomy_level: 2, description: "Llamadas API externas permitidas desde nivel 2." },
  create_agent:    { allowed: true,  requires_approval: true,  min_autonomy_level: 3, description: "Crear agentes requiere aprobación." },
  send_message:    { allowed: true,  requires_approval: false, min_autonomy_level: 1, description: "Enviar mensajes de respuesta siempre permitido." },
  access_billing:  { allowed: false, requires_approval: true,  min_autonomy_level: 5, description: "Acceso a facturación requiere máxima autonomía y aprobación." },
};

export function checkGovernance(
  action: ActionType,
  autonomyLevel: number,
  agentSlug?: string
): GovernanceResult {
  const rule = BASE_RULES[action];
  if (!rule) {
    return {
      allowed: false,
      requires_human_approval: true,
      reason: `Acción desconocida '${action}' — denegada por defecto.`,
      autonomy_level_required: 99,
    };
  }

  if (!rule.allowed && autonomyLevel < rule.min_autonomy_level) {
    return {
      allowed: false,
      requires_human_approval: true,
      reason: `${rule.description} (nivel actual: ${autonomyLevel}, mínimo: ${rule.min_autonomy_level})`,
      autonomy_level_required: rule.min_autonomy_level,
    };
  }

  if (autonomyLevel >= rule.min_autonomy_level && !rule.requires_approval) {
    return {
      allowed: true,
      requires_human_approval: false,
      reason: `Acción '${action}' permitida en nivel ${autonomyLevel}.`,
      autonomy_level_required: rule.min_autonomy_level,
    };
  }

  // Nivel 5: aprobación implícita si la acción base está permitida
  if (autonomyLevel === 5 && rule.allowed) {
    return {
      allowed: true,
      requires_human_approval: false,
      reason: `Nivel 5 (Optimización continua): '${action}' ejecutado sin bloqueo.`,
      autonomy_level_required: rule.min_autonomy_level,
    };
  }

  return {
    allowed: rule.allowed,
    requires_human_approval: rule.requires_approval,
    reason: rule.description,
    autonomy_level_required: rule.min_autonomy_level,
  };
}

export const AUTONOMY_LEVELS = {
  1: { name: "Asistente",            description: "Solo sugiere. No ejecuta nada sin confirmación explícita." },
  2: { name: "Analista",             description: "Lee y analiza. Puede llamar APIs de lectura. No modifica." },
  3: { name: "Ejecutor supervisado", description: "Puede escribir archivos y crear agentes con aprobación." },
  4: { name: "Operador autónomo",    description: "Puede hacer commits y deployar con aprobación humana." },
  5: { name: "Optimización continua",description: "Autonomía máxima. Acciones críticas se ejecutan y se registran." },
} as const;
