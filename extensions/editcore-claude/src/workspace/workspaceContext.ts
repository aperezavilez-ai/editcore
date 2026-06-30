import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { guessDevPort } from "../preview/projectDevServer";
import { findActiveDevPort } from "../preview/localPreview";
import { isReadableFileSync } from "../fs/workspaceFs";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "dist",
  "build",
  "coverage",
  ".vercel",
]);

export interface WorkspaceSnapshot {
  name: string;
  root: string;
  summary: string;
}

function listProjectTree(root: string, maxLines = 60): string[] {
  const lines: string[] = [];

  function walk(dir: string, prefix: string, depth: number): void {
    if (lines.length >= maxLines || depth > 3) {
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const sorted = entries
      .filter((e) => !SKIP_DIRS.has(e.name))
      .filter((e) => !e.name.startsWith(".") || e.name === ".editcore")
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      if (lines.length >= maxLines) {
        lines.push(`${prefix}...`);
        return;
      }
      const rel = path.relative(root, path.join(dir, entry.name)).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        walk(path.join(dir, entry.name), `${prefix}  `, depth + 1);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  for (const entry of ["src", "app", "pages", "components", "lib", "supabase"]) {
    const abs = path.join(root, entry);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      lines.push(`${entry}/`);
      walk(abs, "  ", 1);
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  if (lines.length < 10) {
    walk(root, "", 0);
  }

  return lines;
}

function readSnippet(filePath: string, maxChars = 400): string | undefined {
  if (!isReadableFileSync(filePath)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return undefined;
    }
    return raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
  } catch {
    return undefined;
  }
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  const root = folder.uri.fsPath;
  const name = folder.name;
  const lines: string[] = [`Carpeta abierta: ${name}`, `Ruta absoluta: ${root}`];

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

  const tree = listProjectTree(root);
  if (tree.length) {
    lines.push("Estructura del código (parcial):");
    lines.push(...tree.map((l) => `  ${l}`));
  }

  for (const rel of ["README.md", "src/app/page.tsx", "src/app/layout.tsx", "app/page.tsx"]) {
    const abs = path.join(root, rel);
    if (isReadableFileSync(abs)) {
      const snippet = readSnippet(abs);
      if (snippet) {
        lines.push(`Extracto ${rel}:\n${snippet}`);
      }
      break;
    }
  }

  if (fs.existsSync(path.join(root, "supabase"))) {
    lines.push("Incluye carpeta supabase/ (Supabase).");
  }
  if (fs.existsSync(path.join(root, "next.config.ts")) || fs.existsSync(path.join(root, "next.config.js"))) {
    lines.push("Stack: Next.js.");
  }

  const activePort = await findActiveDevPort(root);
  if (activePort !== undefined) {
    lines.push(
      `Dev server CORRIENDO AHORA en: http://localhost:${activePort} (puerto detectado activo en este momento — ` +
        `usa SIEMPRE este puerto al decirle al usuario dónde recargar, puede no ser el puerto por defecto si ese ` +
        `ya estaba ocupado).`
    );
  } else {
    const devPort = guessDevPort(root);
    lines.push(
      `Dev server no detectado activo ahora mismo. Puerto habitual según package.json: http://localhost:${devPort} ` +
        `(esto es solo una suposición; si el usuario menciona un puerto distinto en su terminal, usa ese).`
    );
  }

  return { name, root, summary: lines.join("\n") };
}

export async function getWorkspaceContextBlock(): Promise<string | undefined> {
  const snap = await getWorkspaceSnapshot();
  if (!snap) {
    return undefined;
  }
  return [
    "=== PROYECTO ABIERTO EN EDITCORE (ya cargado) ===",
    snap.summary,
    "IMPORTANTE: El proyecto ya está abierto. Usa herramientas (list_directory, read_file, search_codebase, run_command).",
    "PROHIBIDO: pedir al usuario que comparta archivos, que ejecute dir/ls/grep en terminal, o escribir <tool_call> en texto.",
    "================================================",
  ].join("\n");
}
