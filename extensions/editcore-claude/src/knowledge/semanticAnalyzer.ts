/**
 * Análisis semántico del código — Fase 8 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getRagIndex } from "../rag/chunkIndex";
import type { SemanticFinding } from "./types";

const SKIP = new Set(["node_modules", ".git", "dist", "out"]);

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function countPattern(files: string[], pattern: RegExp): number {
  let n = 0;
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, "utf8");
      const matches = content.match(pattern);
      if (matches) n += matches.length;
    } catch {
      // skip
    }
  }
  return n;
}

function collectSourceFiles(root: string, max = 80): string[] {
  const result: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3 || result.length >= max) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
        result.push(path.join(dir, e.name));
      }
    }
  };
  walk(root, 0);
  return result;
}

export async function runSemanticAnalysis(root?: string): Promise<SemanticFinding[]> {
  const ws = root ?? workspaceRoot();
  if (!ws) return [];

  const findings: SemanticFinding[] = [];
  const files = collectSourceFiles(ws);

  const todoCount = countPattern(files, /TODO|FIXME|HACK/gi);
  if (todoCount > 5) {
    findings.push({
      kind: "debt",
      severity: todoCount > 20 ? "high" : "medium",
      message: todoCount + " marcadores TODO/FIXME en el código",
    });
  }

  const anyCount = countPattern(files, /:\s*any\b/g);
  if (anyCount > 10) {
    findings.push({
      kind: "debt",
      severity: "medium",
      message: anyCount + " usos de tipo `any` — considerar tipado estricto",
    });
  }

  try {
    await getRagIndex().ensureBuilt();
    const ragPath = path.join(ws, ".editcore", "rag", "index.json");
    if (fs.existsSync(ragPath)) {
      const rag = JSON.parse(fs.readFileSync(ragPath, "utf8")) as {
        chunks?: Array<{ path: string; text: string }>;
      };
      const byPath = new Map<string, number>();
      for (const c of rag.chunks ?? []) {
        const sig = c.text.slice(0, 80);
        byPath.set(sig, (byPath.get(sig) ?? 0) + 1);
      }
      const dups = [...byPath.entries()].filter(([, n]) => n > 2);
      if (dups.length) {
        findings.push({
          kind: "duplication",
          severity: "low",
          message: dups.length + " fragmentos de código repetidos detectados en índice RAG",
        });
      }
    }
  } catch {
    // optional
  }

  if (files.some((f) => f.includes("orchestrator"))) {
    findings.push({
      kind: "pattern",
      severity: "low",
      message: "Patrón orchestrator/middleware detectado — usar contextAssembler unificado",
      paths: files.filter((f) => f.includes("orchestrator")).slice(0, 3),
    });
  }

  findings.push({
    kind: "improvement",
    severity: "low",
    message: "Ejecutar editcore.knowledge.reindex tras cambios grandes para mantener RAG actualizado",
  });

  return findings;
}

export function formatSemanticFindingsMarkdown(findings: SemanticFinding[]): string {
  const lines = ["# Análisis semántico", ""];
  if (findings.length === 0) {
    lines.push("_Sin hallazgos._");
    return lines.join("\n");
  }
  for (const f of findings) {
    lines.push("- **" + f.kind + "** (" + f.severity + "): " + f.message);
  }
  return lines.join("\n");
}
