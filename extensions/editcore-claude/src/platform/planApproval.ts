import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface StructuredPlan {
  id: string;
  createdAt: string;
  objective: string;
  steps: string[];
  risks: string[];
  benefits: string[];
  rollback: string[];
  rawText: string;
}

export function parseStructuredPlan(rawText: string, objective: string): StructuredPlan {
  const extractSection = (label: string): string[] => {
    const re = new RegExp(`(?:^|\\n)#{0,3}\\s*${label}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, "i");
    const m = rawText.match(re);
    if (!m) return [];
    return m[1]
      .split("\n")
      .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
      .filter(Boolean);
  };

  const steps =
    extractSection("plan|pasos|steps").length > 0
      ? extractSection("plan|pasos|steps")
      : rawText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^\d+[\.)]/.test(l) || /^-\s/.test(l))
          .map((l) => l.replace(/^[\d.)]+\s*|^-\s*/, ""));

  return {
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    objective,
    steps: steps.length ? steps : [rawText.slice(0, 500)],
    risks: extractSection("riesgos|risks"),
    benefits: extractSection("beneficios|benefits"),
    rollback: extractSection("reversión|rollback|reversion"),
    rawText,
  };
}

export function formatPlanForDisplay(plan: StructuredPlan): string {
  const lines = [
    `## Objetivo`,
    plan.objective,
    ``,
    `## Plan (${plan.steps.length} pasos)`,
    ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
  ];
  if (plan.risks.length) {
    lines.push(``, `## Riesgos`, ...plan.risks.map((r) => `- ${r}`));
  }
  if (plan.benefits.length) {
    lines.push(``, `## Beneficios`, ...plan.benefits.map((b) => `- ${b}`));
  }
  if (plan.rollback.length) {
    lines.push(``, `## Plan de reversión`, ...plan.rollback.map((r) => `- ${r}`));
  }
  return lines.join("\n");
}

export async function requestPlanApproval(plan: StructuredPlan): Promise<"approved" | "rejected" | "edit"> {
  const preview = formatPlanForDisplay(plan).slice(0, 1200);
  const doc = await vscode.workspace.openTextDocument({
    content: `${preview}\n\n---\n\n${plan.rawText}`,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });

  const choice = await vscode.window.showInformationMessage(
    "EditCore: ¿Aprobar el plan antes de ejecutar?",
    { modal: true, detail: plan.steps.slice(0, 3).join(" → ") },
    "Aprobar y ejecutar",
    "Rechazar",
    "Editar en chat"
  );

  if (choice === "Aprobar y ejecutar") return "approved";
  if (choice === "Editar en chat") return "edit";
  return "rejected";
}

export async function savePlan(plan: StructuredPlan, workspaceRoot: string): Promise<string> {
  const dir = path.join(workspaceRoot, ".editcore", "plans");
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${plan.id}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(plan, null, 2), "utf8");
  const mdPath = path.join(dir, `${plan.id}.md`);
  await fs.promises.writeFile(mdPath, formatPlanForDisplay(plan), "utf8");
  return filePath;
}

export function isPlanApprovalEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("plan.requireApproval", true);
}
