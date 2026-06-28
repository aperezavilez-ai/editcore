/**
 * Documentación — Prompt 4 (5 archivos).
 */
import * as fs from "fs";
import * as path from "path";

const DOCS: Array<{ name: string; content: string }> = [
  {
    name: "EDITCORE_AUTONOMOUS_ENGINE.md",
    content: `# EDITCORE Autonomous Developer Engine

## Visión

Motor de desarrollo autónomo que transforma objetivos humanos en cambios reales de software.

## Módulos

\`\`\`
Usuario → TASK ENGINE (autonomous/taskEngine.ts)
       → PROJECT_ANALYZER → AUTONOMOUS_PLANNER
       → GIT_MANAGER → AOS / AUTONOMOUS_CODER
       → SELF_DEBUG_LOOP → QUALITY_GATE
       → IMPROVEMENT_GENERATOR
\`\`\`

## Comandos

- \`editcore.autonomous.run\` — ciclo completo
- \`editcore.autonomous.analyzeProject\` — PROJECT_UNDERSTANDING.md
- \`editcore.autonomous.generatePlan\` — plan sin ejecutar
- \`editcore.autonomous.openWorkbench\` — historial
- \`editcore.autonomous.setMode\` — copiloto / autónomo
- \`editcore.autonomous.generateDocs\` — esta documentación

## Settings

- \`editcore.autonomous.enabled\`
- \`editcore.autonomous.mode\` — copilot | autonomous
- \`editcore.autonomous.maxDebugCycles\` (default 3)
- \`editcore.autonomous.useAosPipeline\` (default true)
- \`editcore.autonomous.autoCommit\` (default false)
- \`editcore.autonomous.confirmCritical\` (default true)
`,
  },
  {
    name: "EDITCORE_TASK_SYSTEM.md",
    content: `# EDITCORE Task System

## EDITCORE TASK ENGINE

1. Recibe objetivo del usuario
2. Analiza requerimientos (PROJECT_UNDERSTANDING)
3. Convierte en tareas técnicas (AUTONOMOUS_PLAN)
4. Asigna agentes (via AOS pipeline)
5. Ejecuta implementación
6. Supervisa con Self Debug Loop
7. Genera TASK_COMPLETION_REPORT

## Artefactos

| Archivo | Ubicación |
|---------|-----------|
| PROJECT_UNDERSTANDING.md | .editcore/docs/ |
| AUTONOMOUS_PLAN.md | .editcore/autonomous/ |
| TASK_COMPLETION_REPORT.md | .editcore/reports/ |
| NEXT_IMPROVEMENT_PLAN.md | .editcore/docs/ |
| execution-log.jsonl | .editcore/autonomous/ |

## Niveles de autonomía

Integrado con \`editcore.autonomy.level\` (1–5).
`,
  },
  {
    name: "EDITCORE_GIT_AUTOMATION.md",
    content: `# EDITCORE Git Automation

## EDITCORE GIT MANAGER

- Rama automática: \`editcore/work-YYYYMMDD-<taskId>\`
- Punto de restauración: stash + marker en \`.editcore/git/restore-points/\`
- Commits descriptivos (opcional, \`autonomous.autoCommit\`)
- PR via \`gh pr create\` si GitHub CLI disponible

## Reglas

- Nunca push --force (Security Guard)
- Confirmación para commits y PRs
- Rama de evolución antes de cambios en main/master
`,
  },
  {
    name: "EDITCORE_SELF_DEBUG_SYSTEM.md",
    content: `# EDITCORE Self Debug System

## Flujo

\`\`\`
Crear cambio → Ejecutar pruebas → ¿Error?
     ↓ sí
Analizar causa (Debug Agent / Coder)
     ↓
Corregir → Volver a probar → ¿OK?
     ↓
Confirmar (máx N ciclos, default 3)
\`\`\`

## Configuración

\`editcore.autonomous.maxDebugCycles\` — límite anti-bucle infinito.

## Validación

Usa \`postChangeValidator\`: npm test, npm run build según package.json.
`,
  },
  {
    name: "EDITCORE_AUTONOMOUS_WORKFLOW.md",
    content: `# EDITCORE Autonomous Workflow

## Modo Copiloto

- Sugiere y explica
- Genera plan
- Espera aprobación antes de escribir código

## Modo Autónomo

- Planifica e implementa
- Prueba y corrige (Self Debug Loop)
- Genera reportes

## Ciclo completo (ejemplo: "Agrega auth con Google")

1. PROJECT_UNDERSTANDING — framework, deps, APIs
2. AUTONOMOUS_PLAN — pasos, archivos, pruebas
3. Git branch + restore point
4. AOS pipeline (Architect → Developer → Review → QA → Security)
5. Self Debug Loop si fallan tests
6. TASK_COMPLETION_REPORT
7. NEXT_IMPROVEMENT_PLAN

## Integración

- AOS (Prompt 3): pipeline multiagente
- Autonomy (Prompt 1–2): niveles y cola
- Evolution: reportes y roadmap
`,
  },
];

export async function writeAutonomousDocumentation(root: string): Promise<string[]> {
  const written: string[] = [];
  const targets = [
    path.join(root, ".editcore", "docs"),
    path.join(root, "docs"),
  ];

  for (const dir of targets) {
    await fs.promises.mkdir(dir, { recursive: true });
    for (const doc of DOCS) {
      const filePath = path.join(dir, doc.name);
      await fs.promises.writeFile(filePath, doc.content + "\n", "utf8");
      if (!written.includes(filePath)) {
        written.push(filePath);
      }
    }
  }

  return written;
}
