import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { runWorkspaceChecks } from "../diagnostics/checks/workspaceChecks";

const execAsync = promisify(exec);

export interface AuditSection {
  title: string;
  items: string[];
  severity: "ok" | "info" | "warning" | "critical";
}

export interface AuditReport {
  generatedAt: string;
  workspaceName: string;
  workspacePath: string;
  sections: AuditSection[];
  summary: { ok: number; info: number; warning: number; critical: number };
}

function countSeverities(sections: AuditSection[]): AuditReport["summary"] {
  const s = { ok: 0, info: 0, warning: 0, critical: 0 };
  for (const sec of sections) {
    s[sec.severity]++;
  }
  return s;
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function scanStructure(root: string): Promise<AuditSection> {
  const items: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  items.push(`Carpetas: ${dirs.slice(0, 20).join(", ") || "(ninguna)"}`);
  items.push(`Archivos raíz: ${files.slice(0, 15).join(", ") || "(ninguno)"}`);
  const hasSrc = dirs.includes("src") || dirs.includes("app") || dirs.includes("pages");
  const hasTests = dirs.includes("test") || dirs.includes("tests") || dirs.includes("__tests__");
  return {
    title: "Arquitectura / estructura",
    items,
    severity: hasSrc ? "ok" : "warning",
  };
}

async function scanDependencies(root: string): Promise<AuditSection> {
  const items: string[] = [];
  const manifests = ["package.json", "requirements.txt", "go.mod", "Cargo.toml", "pom.xml"];
  let found = false;
  for (const m of manifests) {
    const p = path.join(root, m);
    if (!fs.existsSync(p)) continue;
    found = true;
    if (m === "package.json") {
      try {
        const pkg = JSON.parse(fs.readFileSync(p, "utf8")) as {
          name?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          scripts?: Record<string, string>;
        };
        items.push(`Proyecto: ${pkg.name ?? "sin nombre"}`);
        const depCount = Object.keys(pkg.dependencies ?? {}).length;
        const devCount = Object.keys(pkg.devDependencies ?? {}).length;
        items.push(`Dependencias: ${depCount} prod, ${devCount} dev`);
        const scripts = Object.keys(pkg.scripts ?? {});
        if (scripts.length) items.push(`Scripts: ${scripts.join(", ")}`);
      } catch {
        items.push("package.json ilegible");
      }
    } else {
      items.push(`Manifest: ${m}`);
    }
  }
  if (!found) items.push("Sin manifest de dependencias detectado");
  return { title: "Dependencias", items, severity: found ? "ok" : "info" };
}

async function scanEnvAndSecrets(root: string): Promise<AuditSection> {
  const items: string[] = [];
  const envFiles = [".env", ".env.local", ".env.example", ".env.production"];
  let hasExample = false;
  let hasReal = false;
  for (const f of envFiles) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    if (f.includes("example")) hasExample = true;
    else hasReal = true;
    items.push(`Encontrado: ${f}`);
  }
  if (hasReal && !hasExample) {
    items.push("Recomendación: añadir .env.example sin secretos");
  }
  const gitignore = path.join(root, ".gitignore");
  if (fs.existsSync(gitignore)) {
    const gi = fs.readFileSync(gitignore, "utf8");
    if (!gi.includes(".env")) items.push("Advertencia: .env no está en .gitignore");
    else items.push(".env en .gitignore: OK");
  }
  return {
    title: "Variables / secretos",
    items: items.length ? items : ["Sin archivos .env detectados"],
    severity: hasReal && !hasExample ? "warning" : "ok",
  };
}

async function scanDeployments(root: string): Promise<AuditSection> {
  const items: string[] = [];
  if (fs.existsSync(path.join(root, ".vercel", "project.json"))) {
    items.push("Vercel: proyecto vinculado (.vercel/project.json)");
  } else {
    items.push("Vercel: no vinculado");
  }
  if (fs.existsSync(path.join(root, "supabase", "config.toml"))) {
    items.push("Supabase: config local (supabase/config.toml)");
  } else {
    items.push("Supabase: sin config local");
  }
  const docker = fs.existsSync(path.join(root, "docker-compose.yml")) || fs.existsSync(path.join(root, "Dockerfile"));
  if (docker) items.push("Docker: Dockerfile o docker-compose presente");
  return { title: "Despliegues / infra", items, severity: "info" };
}

async function scanCiCd(root: string): Promise<AuditSection> {
  const items: string[] = [];
  const ghWorkflows = path.join(root, ".github", "workflows");
  if (fs.existsSync(ghWorkflows)) {
    const files = fs.readdirSync(ghWorkflows).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    items.push(`GitHub Actions: ${files.length} workflow(s) — ${files.join(", ") || "ninguno"}`);
  } else {
    items.push("Sin .github/workflows");
  }
  return { title: "CI/CD", items, severity: fs.existsSync(ghWorkflows) ? "ok" : "info" };
}

async function scanSecurity(root: string): Promise<AuditSection> {
  const items: string[] = [];
  const sensitive = [".pem", ".key", "id_rsa", "credentials.json"];
  const found: string[] = [];
  function walk(dir: string, depth: number): void {
    if (depth > 3 || found.length >= 5) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !["node_modules", ".git", "dist", "build", ".next"].includes(e.name)) {
        walk(full, depth + 1);
      } else if (e.isFile() && sensitive.some((s) => e.name.includes(s))) {
        found.push(path.relative(root, full));
      }
    }
  }
  walk(root, 0);
  if (found.length) {
    items.push(`Archivos sensibles detectados: ${found.join(", ")}`);
  } else {
    items.push("Sin archivos de clave obvios en primeros niveles");
  }
  return { title: "Seguridad", items, severity: found.length ? "warning" : "ok" };
}

async function scanGit(root: string): Promise<AuditSection> {
  const items: string[] = [];
  if (!fs.existsSync(path.join(root, ".git"))) {
    return { title: "Git", items: ["No es repositorio git"], severity: "info" };
  }
  try {
    const { stdout: branch } = await execAsync("git branch --show-current", { cwd: root, timeout: 10_000 });
    items.push(`Rama: ${branch.trim() || "(detached)"}`);
    const { stdout: status } = await execAsync("git status --porcelain", { cwd: root, timeout: 10_000 });
    const lines = status.trim().split("\n").filter(Boolean);
    items.push(`Cambios sin commit: ${lines.length}`);
    if (lines.length > 0 && lines.length <= 8) {
      items.push(...lines.map((l) => `  ${l}`));
    }
  } catch (err) {
    items.push(`Error git: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { title: "Git", items, severity: "ok" };
}

export async function runProjectAudit(): Promise<AuditReport | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const root = getWorkspaceRoot();
  if (!folder || !root) {
    vscode.window.showWarningMessage("EditCore: abrí un workspace para auditar.");
    return undefined;
  }

  const sections: AuditSection[] = [];
  sections.push(await scanStructure(root));
  sections.push(await scanDependencies(root));
  sections.push(await scanEnvAndSecrets(root));
  sections.push(await scanDeployments(root));
  sections.push(await scanCiCd(root));
  sections.push(await scanSecurity(root));
  sections.push(await scanGit(root));

  const diagFindings = await runWorkspaceChecks();
  const diagItems = diagFindings.map(
    (f) => `[${f.severity}] ${f.title}: ${f.message}${f.hint ? ` — ${f.hint}` : ""}`
  );
  const worst =
    diagFindings.some((f) => f.severity === "critical")
      ? "critical"
      : diagFindings.some((f) => f.severity === "warning")
        ? "warning"
        : "ok";
  sections.push({ title: "Diagnóstico IDE", items: diagItems, severity: worst as AuditSection["severity"] });

  return {
    generatedAt: new Date().toISOString(),
    workspaceName: folder.name,
    workspacePath: root,
    sections,
    summary: countSeverities(sections),
  };
}

export function formatAuditMarkdown(report: AuditReport): string {
  const lines: string[] = [
    `# Auditoría EditCore — ${report.workspaceName}`,
    ``,
    `**Fecha:** ${report.generatedAt}`,
    `**Ruta:** \`${report.workspacePath}\``,
    ``,
    `## Resumen`,
    `- OK: ${report.summary.ok} | Info: ${report.summary.info} | Advertencias: ${report.summary.warning} | Crítico: ${report.summary.critical}`,
    ``,
  ];
  for (const sec of report.sections) {
    lines.push(`## ${sec.title} [${sec.severity}]`);
    for (const item of sec.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function saveAuditReport(report: AuditReport): Promise<string> {
  const reportsDir = path.join(report.workspacePath, ".editcore", "reports");
  await fs.promises.mkdir(reportsDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const filePath = path.join(reportsDir, `audit-${stamp}.md`);
  await fs.promises.writeFile(filePath, formatAuditMarkdown(report), "utf8");
  return filePath;
}
