import type { DiagnosticFinding } from "../diagnostics/diagnosticTypes";
import type { SystemSnapshot } from "../intelligence/types";
import type { AutonomyTask, AutonomyTaskKind, TaskPlannerInput } from "./types";

function taskId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

function basePrompt(
  title: string,
  evidence: string,
  instructions: string,
  files?: string[]
): { cursorPrompt: string; agentPrompt: string } {
  const fileBlock =
    files && files.length > 0
      ? `\n\nArchivos relacionados:\n${files.map((f) => `- ${f}`).join("\n")}`
      : "";

  const cursorPrompt = [
    `# EditCore — tarea de automejora real`,
    "",
    `## ${title}`,
    "",
    evidence,
    fileBlock,
    "",
    "## Instrucciones",
    instructions,
    "",
    "Reglas: usa solo datos reales del repo; no simules herramientas ni inventes archivos.",
  ].join("\n");

  const agentPrompt = [
    `TAREA DE AUTOMEJORA REAL DE EDITCORE (no simular, usar herramientas):`,
    "",
    `**${title}**`,
    "",
    evidence,
    fileBlock,
    "",
    instructions,
    "",
    "Obligatorio: list_directory, read_file, search_files antes de escribir. apply_patch/write_file solo con diff aprobado.",
  ].join("\n");

  return { cursorPrompt, agentPrompt };
}

type FindingRule = {
  kind: AutonomyTaskKind;
  autoExecutable: boolean;
  files?: string[];
  build: (finding: DiagnosticFinding, snapshot: SystemSnapshot) => {
    title: string;
    description: string;
    instructions: string;
    files?: string[];
  };
};

const FINDING_RULES: Record<string, FindingRule> = {
  "api.key": {
    kind: "fix_config",
    autoExecutable: false,
    build: (f) => ({
      title: "Configurar API Key de Anthropic",
      description: "Sin key válida el chat y el agente no pueden operar.",
      instructions:
        "Indica al usuario abrir el panel Cuenta & API y pegar una key real de console.anthropic.com. No inventes keys ni simules llamadas API.",
    }),
  },
  "api.openai": {
    kind: "fix_config",
    autoExecutable: false,
    build: (f) => ({
      title: "Configurar API Key de OpenAI (respaldo)",
      description: f.message,
      instructions:
        "Guía al usuario para configurar OpenAI en el panel de APIs como respaldo. Verifica editcore.fallback.enabled.",
    }),
  },
  "api.model": {
    kind: "fix_config",
    autoExecutable: true,
    files: ["extensions/editcore-claude/src/models.ts", "branding/default-settings.json"],
    build: (f) => ({
      title: "Corregir modelo Claude obsoleto",
      description: f.message,
      instructions:
        "Busca referencias al modelo retirado, actualiza a claude-sonnet-4-6 (o el default en models.ts) y migra settings del usuario si hace falta.",
    }),
  },
  "rag.index": {
    kind: "investigate",
    autoExecutable: true,
    files: ["extensions/editcore-claude/src/rag/chunkIndex.ts"],
    build: (f) => ({
      title: "Reconstruir índice RAG del workspace",
      description: f.message,
      instructions:
        "Diagnostica por qué el índice RAG está vacío o desactualizado. Si el workspace es grande, verifica exclusiones. Propón run_command para reindexar solo si el usuario aprueba.",
    }),
  },
  "index.keyword": {
    kind: "investigate",
    autoExecutable: true,
    files: ["extensions/editcore-claude/src/index/workspaceIndex.ts"],
    build: (f) => ({
      title: "Reparar índice de keywords del workspace",
      description: f.message,
      instructions:
        "Revisa workspaceIndex y warm-up en extension.ts. Corrige errores de indexación sin bloquear el IDE.",
    }),
  },
  "mcp.config": {
    kind: "fix_config",
    autoExecutable: true,
    files: [".editcore/mcp.json", "extensions/editcore-claude/src/mcp/mcpClient.ts"],
    build: (f) => ({
      title: "Corregir configuración MCP",
      description: f.message,
      instructions:
        "Lee .editcore/mcp.json y valida servidores. Corrige JSON inválido o rutas incorrectas. Documenta cambios en tech-memory.",
    }),
  },
  "build.portable": {
    kind: "run_command",
    autoExecutable: false,
    files: ["scripts/deploy-extensions-to-portable.ps1"],
    build: (f) => ({
      title: "Sincronizar build portable con extensión actual",
      description: f.message,
      instructions:
        "Verifica que VSCode-win32-x64 tenga la extensión compilada. Propón ejecutar scripts/deploy-extensions-to-portable.ps1 (usuario debe cerrar EditCore.exe).",
    }),
  },
  "editcore.rules": {
    kind: "document",
    autoExecutable: true,
    files: [".editcore/rules.md"],
    build: (f) => ({
      title: "Crear .editcore/rules.md del proyecto",
      description: f.message,
      instructions:
        "Genera rules.md con convenciones del workspace basadas en package.json y estructura real. No uses plantillas genéricas.",
    }),
  },
  "editcore.memory": {
    kind: "document",
    autoExecutable: true,
    files: [".editcore/memory.md"],
    build: (f) => ({
      title: "Inicializar memoria del proyecto",
      description: f.message,
      instructions:
        "Crea .editcore/memory.md con stack, objetivos y decisiones detectadas en el repo.",
    }),
  },
};

function priorityForSeverity(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  if (severity === "info") return 2;
  return 3;
}

function taskFromFinding(
  finding: DiagnosticFinding,
  snapshot: SystemSnapshot,
  index: number
): AutonomyTask | null {
  if (finding.severity === "ok") {
    return null;
  }

  const rule = FINDING_RULES[finding.id];
  const built = rule
    ? rule.build(finding, snapshot)
    : {
        title: finding.title,
        description: finding.message,
        instructions: finding.hint
          ? `${finding.hint}\n\nInvestiga con herramientas reales y propón un fix mínimo verificable.`
          : "Investiga la causa con read_file/search_files y aplica un fix mínimo verificable.",
        files: undefined as string[] | undefined,
      };

  const files = rule?.files ?? built.files;
  const prompts = basePrompt(
    built.title,
    `Hallazgo real (${finding.severity}): ${finding.message}`,
    built.instructions,
    files
  );

  return {
    id: taskId(finding.id.replace(/\./g, "-"), index),
    priority: priorityForSeverity(finding.severity),
    kind: rule?.kind ?? "investigate",
    status: "pending",
    title: built.title,
    description: built.description,
    evidence: `${finding.id}: ${finding.message}`,
    findingId: finding.id,
    relatedFiles: files,
    autoExecutable: rule?.autoExecutable ?? finding.severity !== "critical",
    ...prompts,
  };
}

function integrationTasks(snapshot: SystemSnapshot): AutonomyTask[] {
  const tasks: AutonomyTask[] = [];
  if (!snapshot.apiKeys.hasAnthropic && !snapshot.apiKeys.hasOpenAi) {
    const prompts = basePrompt(
      "Configurar al menos una API Key",
      "Snapshot real: sin Anthropic ni OpenAI configuradas.",
      "El usuario debe abrir Cuenta & API. No continúes tareas que gasten tokens hasta tener key.",
      ["extensions/editcore-claude/src/apiKeyService.ts"]
    );
    tasks.push({
      id: "integration-api-keys",
      priority: 0,
      kind: "fix_config",
      status: "pending",
      title: "Configurar API Keys",
      description: "Sin keys no hay chat ni agente real.",
      evidence: "apiKeys.hasAnthropic=false, hasOpenAi=false",
      autoExecutable: false,
      ...prompts,
    });
  }
  return tasks;
}

export function planAutonomyTasks(input: TaskPlannerInput): AutonomyTask[] {
  const tasks: AutonomyTask[] = [];
  const seen = new Set<string>();

  for (const [index, finding] of input.findings.entries()) {
    if (finding.severity === "ok" || seen.has(finding.id)) {
      continue;
    }
    const task = taskFromFinding(finding, input.snapshot, index);
    if (task) {
      seen.add(finding.id);
      tasks.push(task);
    }
  }

  for (const t of integrationTasks(input.snapshot)) {
    if (!seen.has(t.id)) {
      tasks.push(t);
      seen.add(t.id);
    }
  }

  if (input.health.status === "degraded" || input.health.status === "critical") {
    const prompts = basePrompt(
      "Ejecutar autodiagnóstico completo y registrar en tech-memory",
      `Estado de salud: ${input.health.status}. Críticos: ${input.health.diagnosticSummary.critical}, warnings: ${input.health.diagnosticSummary.warning}.`,
      "Ejecuta run_self_diagnostic sin análisis Claude (local). Guarda resumen en .editcore/tech-memory/ si hay permiso.",
      ["extensions/editcore-claude/src/diagnostics/diagnosticService.ts"]
    );
    tasks.push({
      id: "health-full-diagnostic",
      priority: 1,
      kind: "investigate",
      status: "pending",
      title: "Autodiagnóstico completo (local)",
      description: "Consolidar hallazgos antes de aplicar fixes.",
      evidence: `health.status=${input.health.status}`,
      autoExecutable: true,
      ...prompts,
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export function buildAgentExecutionPrompt(tasks: AutonomyTask[], maxTasks = 3): string {
  const pending = tasks.filter((t) => t.status === "pending").slice(0, maxTasks);
  if (pending.length === 0) {
    return "No hay tareas pendientes en la cola de autonomía. Ejecuta editcore.autonomy.diagnose primero.";
  }

  const lines = [
    "MODO AUTONOMÍA REAL DE EDITCORE — ejecuta estas tareas con herramientas (no simules):",
    "",
  ];

  for (const [i, task] of pending.entries()) {
    lines.push(`### Tarea ${i + 1}: ${task.title} (${task.id})`);
    lines.push(task.agentPrompt);
    lines.push("");
  }

  lines.push(
    "Al terminar cada tarea, resume qué archivos tocaste y qué verificaste. Si no puedes ejecutar algo, dilo con evidencia real."
  );

  return lines.join("\n");
}
