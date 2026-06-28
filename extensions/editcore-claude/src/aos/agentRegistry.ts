/**
 * Registro de agentes del Agent Operating System (Fase 2 — Prompt 3).
 */
import type { AgentDefinition } from "./types";

export const AGENT_OS_REGISTRY: AgentDefinition[] = [
  {
    id: "architect",
    label: "Architect Agent",
    responsibilities: [
      "Analizar proyectos completos",
      "Diseñar arquitectura",
      "Crear soluciones técnicas",
      "Detectar problemas estructurales",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    usesTools: true,
    instruction:
      "Diseña la solución: arquitectura, módulos, archivos, riesgos y reversión. No implementes código aún.",
  },
  {
    id: "fullstack",
    label: "Developer Agent",
    responsibilities: [
      "Crear código",
      "Modificar archivos",
      "Implementar funcionalidades",
      "Resolver tareas",
    ],
    preferredProvider: "openai",
    preferredModel: "gpt-4o",
    usesTools: true,
    instruction:
      "Implementa según el diseño del Architect. Usa apply_patch/write_file. Cambios mínimos y verificables.",
  },
  {
    id: "reviewer",
    label: "Code Review Agent",
    responsibilities: [
      "Revisar código generado",
      "Detectar errores",
      "Mejorar calidad",
      "Revisar seguridad básica",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    usesTools: true,
    instruction:
      "Revisa cambios: calidad, seguridad, consistencia. Lista hallazgos accionables. No reescribas todo.",
  },
  {
    id: "debug",
    label: "Debug Agent",
    responsibilities: [
      "Analizar errores",
      "Encontrar causas",
      "Proponer soluciones",
      "Aplicar correcciones mínimas",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    usesTools: true,
    instruction:
      "Analiza errores con read_file, search_files, read_logs. Propón fix mínimo; aplica solo si es crítico.",
  },
  {
    id: "qa",
    label: "QA Agent",
    responsibilities: [
      "Crear/ejecutar pruebas",
      "Validar regresiones",
      "Reportar fallos",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-haiku-4-5",
    usesTools: true,
    instruction:
      "Ejecuta tests con run_command (con aprobación). Reporta regresiones con pasos de reproducción.",
  },
  {
    id: "security",
    label: "Security Agent",
    responsibilities: [
      "Validar OWASP básico",
      "Detectar secretos en diff",
      "Revisar permisos y auth",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    usesTools: true,
    instruction:
      "Audita seguridad: secretos, SQLi/XSS, headers, dependencias. Bloquea si hay riesgo crítico sin fix.",
  },
  {
    id: "documenter",
    label: "Documentation Agent",
    responsibilities: [
      "Crear documentación",
      "Actualizar manuales",
      "Registrar arquitectura",
    ],
    preferredProvider: "openai",
    preferredModel: "gpt-4o",
    usesTools: true,
    instruction:
      "Genera/actualiza docs en .editcore/docs/ o README. Basado solo en cambios reales del ciclo.",
  },
  {
    id: "prompt_engineer",
    label: "Prompt Engineering Agent",
    responsibilities: [
      "Crear prompts evolutivos",
      "Mejorar instrucciones",
      "Crear planes futuros",
    ],
    preferredProvider: "anthropic",
    preferredModel: "claude-haiku-4-5",
    usesTools: false,
    instruction:
      "Resume el ciclo y genera SIGUIENTE_PROMPT con pasos verificables para la próxima iteración.",
  },
];

/** Pipeline completo Fase 6: Dev → Review → Debug → QA → Security → Docs → Prompts */
export const FULL_REVIEW_PIPELINE = AGENT_OS_REGISTRY;

/** Pipeline rápido: solo implementación + review */
export const FAST_PIPELINE = AGENT_OS_REGISTRY.filter((a) =>
  ["architect", "fullstack", "reviewer", "qa"].includes(a.id)
);

export function getAgentsForIntent(intent: string): AgentDefinition[] {
  const lower = intent.toLowerCase();
  if (lower.includes("solo arquitectura") || lower.includes("only architect")) {
    return AGENT_OS_REGISTRY.filter((a) => a.id === "architect");
  }
  if (lower.includes("debug") || lower.includes("error") || lower.includes("falla")) {
    return AGENT_OS_REGISTRY.filter((a) =>
      ["architect", "debug", "fullstack", "qa"].includes(a.id)
    );
  }
  if (lower.includes("rápido") || lower.includes("fast") || lower.includes("minimo")) {
    return FAST_PIPELINE;
  }
  return FULL_REVIEW_PIPELINE;
}
