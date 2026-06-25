import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { listRegisteredProjects, RegisteredProject } from "./projectRegistry";

export interface IntelligenceFinding {
  kind: "duplicate_api" | "shared_dependency" | "repeated_error" | "reusable_module";
  severity: "info" | "warning";
  title: string;
  detail: string;
  projects: string[];
}

function readPackageDeps(projectPath: string): Record<string, string> {
  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

function scanApiRoutes(projectPath: string): string[] {
  const routes: string[] = [];
  const candidates = [
    path.join(projectPath, "src", "app", "api"),
    path.join(projectPath, "pages", "api"),
    path.join(projectPath, "src", "routes"),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      const walk = (d: string, prefix: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const rel = `${prefix}/${e.name}`;
          if (e.isDirectory()) walk(path.join(d, e.name), rel);
          else if (/route\.(ts|js)$|\.(ts|js)$/.test(e.name)) routes.push(rel);
        }
      };
      walk(dir, "");
    } catch {
      // ignore
    }
  }
  return routes.slice(0, 50);
}

export async function analyzeCrossProjects(
  context: vscode.ExtensionContext
): Promise<IntelligenceFinding[]> {
  const projects = await listRegisteredProjects(context);
  const findings: IntelligenceFinding[] = [];

  const depMap = new Map<string, string[]>();
  const apiMap = new Map<string, string[]>();

  for (const p of projects) {
    if (!fs.existsSync(p.path)) continue;
    for (const [dep] of Object.entries(readPackageDeps(p.path))) {
      const list = depMap.get(dep) ?? [];
      list.push(p.name);
      depMap.set(dep, list);
    }
    for (const route of scanApiRoutes(p.path)) {
      const list = apiMap.get(route) ?? [];
      list.push(p.name);
      apiMap.set(route, list);
    }
  }

  for (const [dep, projs] of depMap) {
    if (projs.length >= 2) {
      findings.push({
        kind: "shared_dependency",
        severity: "info",
        title: `Dependencia compartida: ${dep}`,
        detail: `Usada en ${projs.length} proyectos — candidata a librería compartida`,
        projects: [...new Set(projs)],
      });
    }
  }

  for (const [route, projs] of apiMap) {
    if (projs.length >= 2) {
      findings.push({
        kind: "duplicate_api",
        severity: "warning",
        title: `Ruta API similar: ${route}`,
        detail: `Detectada en múltiples proyectos — revisar duplicación`,
        projects: [...new Set(projs)],
      });
    }
  }

  const errors = await loadGlobalErrors(context);
  for (const [err, projs] of errors) {
    if (projs.length >= 2) {
      findings.push({
        kind: "repeated_error",
        severity: "warning",
        title: `Error recurrente: ${err.slice(0, 80)}`,
        detail: `Resuelto o visto en ${projs.length} proyectos`,
        projects: projs,
      });
    }
  }

  return findings.slice(0, 30);
}

async function loadGlobalErrors(
  context: vscode.ExtensionContext
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const { listGlobalMemory } = await import("./globalMemory");
  const entries = await listGlobalMemory(context);
  for (const e of entries.filter((x) => x.type === "error")) {
    const list = map.get(e.title) ?? [];
    if (e.projectName) list.push(e.projectName);
    map.set(e.title, list);
  }
  return map;
}

export function formatIntelligenceReport(findings: IntelligenceFinding[]): string {
  if (!findings.length) return "Sin hallazgos cross-proyecto. Registrá más proyectos abriendo carpetas en EditCore.";
  const lines = ["# Project Intelligence — EditCore", ""];
  for (const f of findings) {
    lines.push(`## [${f.kind}] ${f.title}`);
    lines.push(f.detail);
    lines.push(`Proyectos: ${f.projects.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function saveIntelligenceReport(
  context: vscode.ExtensionContext,
  findings: IntelligenceFinding[]
): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  const dir = path.join(folder.uri.fsPath, ".editcore", "reports");
  await fs.promises.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `intelligence-${stamp}.md`);
  await fs.promises.writeFile(filePath, formatIntelligenceReport(findings), "utf8");
  return filePath;
}
