import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface WorkspaceSnapshot {
  name: string;
  root: string;
  summary: string;
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  const root = folder.uri.fsPath;
  const name = folder.name;
  const lines: string[] = [
    `Carpeta abierta: ${name}`,
    `Ruta: ${root}`,
  ];

  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        name?: string;
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (pkg.name) {
        lines.push(`Proyecto npm: ${pkg.name}`);
      }
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 24);
      if (deps.length) {
        lines.push(`Dependencias clave: ${deps.join(", ")}`);
      }
      const scripts = pkg.scripts ?? {};
      const dev = scripts.dev ? `dev → ${scripts.dev}` : "";
      const build = scripts.build ? `build → ${scripts.build}` : "";
      const start = scripts.start ? `start → ${scripts.start}` : "";
      const scriptLine = [dev, build, start].filter(Boolean).join(" | ");
      if (scriptLine) {
        lines.push(`Scripts: ${scriptLine}`);
      }
    } catch {
      lines.push("package.json presente (no se pudo parsear).");
    }
  }

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    if (dirs.length) {
      lines.push(`Carpetas: ${dirs.slice(0, 20).join(", ")}`);
    }
    if (files.length) {
      lines.push(`Archivos raíz: ${files.slice(0, 20).join(", ")}`);
    }
  } catch {
    // ignore
  }

  if (fs.existsSync(path.join(root, "supabase"))) {
    lines.push("Incluye carpeta supabase/ (Supabase).");
  }
  if (fs.existsSync(path.join(root, "next.config.ts")) || fs.existsSync(path.join(root, "next.config.js"))) {
    lines.push("Proyecto Next.js detectado.");
  }

  const devPort = guessDevPort(root);
  if (devPort) {
    lines.push(`Preview local habitual: http://localhost:${devPort} (Browser: Ctrl+Alt+/ o comando "EditCore: Abrir browser").`);
  }

  return { name, root, summary: lines.join("\n") };
}

export async function getWorkspaceContextBlock(): Promise<string | undefined> {
  const snap = await getWorkspaceSnapshot();
  if (!snap) {
    return undefined;
  }
  return [
    "=== WORKSPACE ABIERTO EN EDITCORE ===",
    snap.summary,
    "Tienes acceso a este proyecto. En modo Agent usa list_directory, read_file, search_codebase y run_command.",
    "No pidas al usuario que comparta archivos si el workspace ya está abierto.",
    "===================================",
  ].join("\n");
}

function guessDevPort(root: string): number | undefined {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return 3000;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    const dev = pkg.scripts?.dev ?? "";
    const m = dev.match(/(?:--port|-p)\s+(\d{2,5})/) ?? dev.match(/:(\d{2,5})/);
    if (m) {
      return Number(m[1]);
    }
  } catch {
    // ignore
  }
  return 3000;
}
