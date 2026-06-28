/**
 * EDITCORE PROJECT KNOWLEDGE ENGINE — Fase 1 (Prompt 5).
 */
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import { analyzeProject } from "../autonomous/projectAnalyzer";
import { buildDependencyGraph } from "../twin/dependencyGraph";
import { getRagIndex } from "../rag/chunkIndex";
import { getWorkspaceIndex } from "../index/workspaceIndex";
import type { ProjectKnowledgeMap } from "./types";

const execAsync = promisify(exec);
const KNOWLEDGE_DIR = path.join(".editcore", "knowledge");
const MAP_FILE = "PROJECT_KNOWLEDGE_MAP.json";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "out", "build", "coverage"]);

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function detectLanguages(root: string): string[] {
  const exts = new Map<string, number>();
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (ext) exts.set(ext, (exts.get(ext) ?? 0) + 1);
      }
    }
  };
  walk(root, 0);
  return [...exts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext]) => ext);
}

async function gitMeta(root: string): Promise<{ branch?: string; commits: string[] }> {
  try {
    await execAsync("git rev-parse --is-inside-work-tree", { cwd: root });
    const { stdout: branch } = await execAsync("git branch --show-current", { cwd: root });
    const { stdout: log } = await execAsync("git log -8 --oneline", { cwd: root });
    return { branch: branch.trim(), commits: log.trim().split("\n").filter(Boolean) };
  } catch {
    return { commits: [] };
  }
}

export async function buildProjectKnowledgeMap(root?: string): Promise<ProjectKnowledgeMap> {
  const wsRoot = root ?? workspaceRoot();
  if (!wsRoot) {
    throw new Error("Sin workspace abierto.");
  }

  const understanding = await analyzeProject(wsRoot);
  const git = await gitMeta(wsRoot);
  const langs = detectLanguages(wsRoot);

  let architectureModules: string[] = [];
  try {
    const graph = await buildDependencyGraph();
    architectureModules = graph.nodes.map((n) => n.id).slice(0, 30);
  } catch {
    architectureModules = understanding.components;
  }

  const configFiles: string[] = [];
  const docFiles: string[] = [];
  const candidates = [
    "package.json",
    "tsconfig.json",
    "README.md",
    ".env.example",
    "docker-compose.yml",
    "docs",
  ];
  for (const c of candidates) {
    const p = path.join(wsRoot, c);
    if (fs.existsSync(p)) {
      if (c.endsWith(".md") || c === "docs") docFiles.push(c);
      else configFiles.push(c);
    }
  }

  let indexedFileCount = 0;
  try {
    await getWorkspaceIndex().ensureIndexed();
    await getRagIndex().ensureBuilt();
    const ragPath = path.join(wsRoot, ".editcore", "rag", "index.json");
    if (fs.existsSync(ragPath)) {
      const rag = JSON.parse(fs.readFileSync(ragPath, "utf8")) as { chunks?: unknown[] };
      indexedFileCount = rag.chunks?.length ?? 0;
    }
  } catch {
    indexedFileCount = 0;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];

  return {
    generatedAt: new Date().toISOString(),
    workspacePath: wsRoot,
    workspaceName: folder?.name,
    framework: understanding.framework,
    languages: langs,
    topLevelDirs: understanding.folderStructure,
    dependencies: understanding.dependencies,
    apis: understanding.apis,
    database: understanding.database,
    configFiles,
    docFiles,
    gitBranch: git.branch,
    recentCommits: git.commits,
    architectureModules,
    indexedFileCount,
    risks: understanding.risks,
  };
}

export async function writeProjectKnowledgeMap(root?: string): Promise<string> {
  const wsRoot = root ?? workspaceRoot();
  if (!wsRoot) {
    throw new Error("Sin workspace.");
  }
  const map = await buildProjectKnowledgeMap(wsRoot);
  const dir = path.join(wsRoot, KNOWLEDGE_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, MAP_FILE);
  await fs.promises.writeFile(filePath, JSON.stringify(map, null, 2) + "\n", "utf8");

  const isDev = fs.existsSync(path.join(wsRoot, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const docsDir = path.join(wsRoot, "docs");
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(docsDir, "PROJECT_KNOWLEDGE_MAP.json"),
      JSON.stringify(map, null, 2) + "\n",
      "utf8"
    );
  }

  return filePath;
}

export function formatProjectKnowledgeMarkdown(map: ProjectKnowledgeMap): string {
  const lines = [
    "# PROJECT KNOWLEDGE MAP",
    "",
    "_EDITCORE Project Knowledge Engine_",
    "",
    "**Generado:** " + map.generatedAt,
    "**Workspace:** " + (map.workspaceName ?? map.workspacePath),
    "",
    "## Framework",
    map.framework ?? "_No detectado_",
    "",
    "## Lenguajes",
    map.languages.map((l) => "- " + l).join("\n"),
    "",
    "## Estructura",
    map.topLevelDirs.map((d) => "- `" + d + "`").join("\n"),
    "",
    "## Dependencias clave",
    map.dependencies.slice(0, 15).map((d) => "- " + d).join("\n"),
    "",
    "## APIs / BD",
    "- APIs: " + (map.apis.join(", ") || "N/A"),
    "- BD: " + (map.database ?? "N/A"),
    "",
    "## Git",
    "- Rama: `" + (map.gitBranch ?? "N/A") + "`",
    ...map.recentCommits.map((c) => "- " + c),
    "",
    "## Módulos arquitectura",
    map.architectureModules.map((m) => "- " + m).join("\n"),
    "",
    "## Indexación",
    "- Chunks RAG: " + map.indexedFileCount,
    "",
    "## Riesgos",
    map.risks.map((r) => "- " + r).join("\n"),
  ];
  return lines.join("\n");
}

export async function loadProjectKnowledgeMap(root?: string): Promise<ProjectKnowledgeMap | undefined> {
  const wsRoot = root ?? workspaceRoot();
  if (!wsRoot) return undefined;
  const filePath = path.join(wsRoot, KNOWLEDGE_DIR, MAP_FILE);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as ProjectKnowledgeMap;
  } catch {
    return undefined;
  }
}
