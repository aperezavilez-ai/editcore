/**
 * Genera PLAN_IMPLEMENTACION_EDITCORE.md — Fase 1 del Evolution Execution System.
 */
import * as fs from "fs";
import * as path from "path";
import type { HealthReport, SystemSnapshot } from "../intelligence/types";
import type { AutonomyTask } from "../autonomy/types";

export interface ImplementationPhase {
  id: number;
  name: string;
  modules: string[];
  files: string[];
  risks: string[];
  tests: string[];
  expectedResult: string;
  status: "pending" | "in_progress" | "done";
}

export const ROADMAP_PHASES: ImplementationPhase[] = [
  {
    id: 1,
    name: "Cerebro IA (orchestrator + pipeline + model routing)",
    modules: ["orchestration/", "agent/"],
    files: [
      "orchestration/orchestrator.ts",
      "orchestration/agentPipeline.ts",
      "orchestration/orchestratorInvoke.ts",
      "orchestration/validateGenerationBridge.ts",
      "agent/multiAgentOrchestrator.ts",
    ],
    risks: ["Dos orchestrators legacy; mitigado con agentPipeline central"],
    tests: ["npm run compile", "orchestrator self-critique wired"],
    expectedResult: "select_model + pipeline 5 roles + validateGeneration activo",
    status: "done",
  },
  {
    id: 2,
    name: "Memoria persistente y conocimiento",
    modules: ["memory/", "intelligence/techMemoryStore.ts"],
    files: ["memory/memoryManager.ts", "memory/projectMemory.ts", "rag/chunkIndex.ts"],
    risks: ["Fragmentación de stores; mitigado con memoryManager"],
    tests: ["memoryManager search/save", "tech-memory append"],
    expectedResult: "Memoria unificada + preparado para RAG",
    status: "done",
  },
  {
    id: 3,
    name: "Herramientas del agente",
    modules: ["agent/tools.ts"],
    files: ["agent/tools.ts", "agent/terminalApproval.ts"],
    risks: ["Ejecución shell; mitigado con aprobación"],
    tests: ["agent-utils.test.js"],
    expectedResult: "20+ tools incl. git, MCP, intelligence",
    status: "done",
  },
  {
    id: 4,
    name: "Sistema multiagente",
    modules: ["agent/multiAgentOrchestrator.ts", "agents/roles.ts"],
    files: ["agent/multiAgentOrchestrator.ts", "orchestration/agentPipeline.ts"],
    risks: ["Costo tokens; opt-in multiAgent.enabled"],
    tests: ["Pipeline manual en Agent mode"],
    expectedResult: "Architect→Coder→Reviewer→QA→Prompt Engineer",
    status: "done",
  },
  {
    id: 5,
    name: "Automatización avanzada (QA/CI)",
    modules: ["evolution/", "platform/postChangeValidator.ts"],
    files: [
      "evolution/qaChecklistGenerator.ts",
      "platform/postChangeValidator.ts",
      ".github/workflows/editcore-ci.yml",
    ],
    risks: ["CI depende de entorno local"],
    tests: ["npm test", "editcore.evolution.cycle"],
    expectedResult: "QA_CHECKLIST + validación post-cambio",
    status: "done",
  },
  {
    id: 6,
    name: "Automejora continua",
    modules: ["autonomy/"],
    files: [
      "autonomy/autonomyEngine.ts",
      "autonomy/autonomyLevel.ts",
      "autonomy/taskPlanner.ts",
    ],
    risks: ["Escritura sin supervisión; niveles 1–5"],
    tests: ["editcore.autonomy.diagnose"],
    expectedResult: "Cola real + niveles de autonomía",
    status: "done",
  },
  {
    id: 7,
    name: "Control Git seguro",
    modules: ["evolution/gitSafeFlow.ts", "agent/tools.ts"],
    files: ["evolution/gitSafeFlow.ts"],
    risks: ["Ramas huérfanas; documentar en REPORTE"],
    tests: ["git_branch tool", "rama antes de write"],
    expectedResult: "git_branch + commit resumido",
    status: "done",
  },
  {
    id: 8,
    name: "Ciclo de calidad y reportes",
    modules: ["evolution/"],
    files: [
      "evolution/changeReportGenerator.ts",
      "evolution/evolutionCycle.ts",
    ],
    risks: ["Reportes desactualizados si no se corre ciclo"],
    tests: ["REPORTE_CAMBIOS generado"],
    expectedResult: "REPORTE + QA tras cada fase",
    status: "done",
  },
  {
    id: 9,
    name: "Prompts evolutivos automáticos",
    modules: ["evolution/evolutionPromptGenerator.ts"],
    files: ["evolution/evolutionPromptGenerator.ts", "evolution/phaseExecutor.ts"],
    risks: ["Prompt genérico sin datos; usa snapshot real"],
    tests: ["SIGUIENTE_PROMPT existe tras ciclo"],
    expectedResult: "SIGUIENTE_PROMPT_EVOLUCION_EDITCORE.md",
    status: "done",
  },
  {
    id: 10,
    name: "Modelos IA por fortaleza",
    modules: ["agent/openaiAgentLoop.ts", "providers/taskRouter.ts"],
    files: ["agent/openaiAgentLoop.ts", "agent/agentLoop.ts"],
    risks: ["OpenAI sin tools si no hay key"],
    tests: ["Coder usa OpenAI cuando hay key"],
    expectedResult: "Claude análisis / OpenAI código",
    status: "done",
  },
];

export function buildPlanMarkdown(
  snapshot: SystemSnapshot,
  health: HealthReport,
  tasks: AutonomyTask[],
  phases: ImplementationPhase[] = ROADMAP_PHASES
): string {
  const lines: string[] = [
    "# PLAN_IMPLEMENTACION_EDITCORE",
    "",
    "_Evolution Execution System — plan técnico vivo_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "**Producto:** v" + snapshot.productVersion + " · **Extensión:** v" + snapshot.extensionVersion,
    "**Salud:** " + health.status + " (críticos: " + health.diagnosticSummary.critical + ", warnings: " + health.diagnosticSummary.warning + ")",
    "",
    "## Regla principal",
    "",
    "NO cambios masivos sin plan. Antes de modificar:",
    "1. Analizar impacto (`analyze_impact`)",
    "2. Crear/actualizar este plan",
    "3. Listar archivos y dependencias",
    "4. Definir pruebas",
    "5. Estrategia de reversión (git branch + REPORTE)",
    "",
    "## Mejoras prioritarias (desde diagnóstico)",
    "",
  ];

  const pending = tasks.filter((t) => t.status === "pending").slice(0, 8);
  if (pending.length === 0) {
    lines.push("_Sin tareas críticas pendientes en cola de autonomía._");
  } else {
    for (const t of pending) {
      lines.push("- **" + t.title + "** (`" + t.id + "`): " + t.evidence);
    }
  }

  lines.push("", "## Orden de ejecución por fases", "");

  for (const phase of phases) {
    const icon = phase.status === "done" ? "✅" : phase.status === "in_progress" ? "🔄" : "⬜";
    lines.push("### FASE " + phase.id + ": " + phase.name + " " + icon, "");
    lines.push("**Módulos:** " + phase.modules.join(", "));
    lines.push("", "**Archivos:**");
    for (const f of phase.files) {
      lines.push("- `" + f + "`");
    }
    lines.push("", "**Riesgos:** " + phase.risks.join("; "));
    lines.push("", "**Pruebas:** " + phase.tests.join("; "));
    lines.push("", "**Resultado esperado:** " + phase.expectedResult, "");
  }

  lines.push(
    "## Dependencias",
    "",
    "- VS Code extension API, Anthropic API, OpenAI API (opcional)",
    "- Node.js para compile/test",
    "- Git para control de versiones",
    "- `.editcore/` inicializado (`editcore.initWorkspace`)",
    "",
    "## Estrategia de reversión",
    "",
    "1. `git_branch` antes de cambios en nivel ≥ 3",
    "2. Commits atómicos con `git_commit`",
    "3. `REPORTE_CAMBIOS_EDITCORE.md` tras cada fase",
    "4. `git reset --hard` solo con aprobación explícita",
    "",
    "## Comandos de ejecución",
    "",
    "| Comando | Acción |",
    "|---------|--------|",
    "| `editcore.evolution.generatePlan` | Regenerar este plan |",
    "| `editcore.evolution.runPhase` | Ejecutar una fase (con QA + reportes) |",
    "| `editcore.evolution.cycle` | Ciclo completo |",
    "| `editcore.autonomy.diagnose` | Diagnóstico + cola de tareas |",
    "",
    "## Nivel de autonomía",
    "",
    "Configurar `editcore.autonomy.level` (1–5). Ver `autonomy/autonomyLevel.ts`.",
    ""
  );

  return lines.join("\n");
}

export async function writeImplementationPlan(
  root: string,
  markdown: string
): Promise<{ editcorePath: string; repoDocsPath?: string }> {
  const docsDir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(docsDir, { recursive: true });
  const editcorePath = path.join(docsDir, "PLAN_IMPLEMENTACION_EDITCORE.md");
  await fs.promises.writeFile(editcorePath, markdown + "\n", "utf8");

  let repoDocsPath: string | undefined;
  const isEditCoreDev = fs.existsSync(
    path.join(root, "extensions", "editcore-claude", "package.json")
  );
  if (isEditCoreDev) {
    const repoDocs = path.join(root, "docs");
    await fs.promises.mkdir(repoDocs, { recursive: true });
    repoDocsPath = path.join(repoDocs, "PLAN_IMPLEMENTACION_EDITCORE.md");
    await fs.promises.writeFile(repoDocsPath, markdown + "\n", "utf8");
  }

  return { editcorePath, repoDocsPath };
}

export async function loadPlanProgress(root: string): Promise<ImplementationPhase[]> {
  const planPath = path.join(root, ".editcore", "docs", "PLAN_IMPLEMENTACION_EDITCORE.md");
  if (!fs.existsSync(planPath)) {
    return [...ROADMAP_PHASES];
  }
  return [...ROADMAP_PHASES];
}
