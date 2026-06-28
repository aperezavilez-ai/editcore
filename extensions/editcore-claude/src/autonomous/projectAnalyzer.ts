/**
 * Análisis automático del proyecto — Fase 2 (Prompt 4).
 */
import * as fs from "fs";
import * as path from "path";
import type { ProjectUnderstanding } from "./types";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  "coverage",
  "VSCode-win32-x64",
]);

function readJsonSafe<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function detectFramework(pkg: Record<string, unknown> | undefined): string | undefined {
  if (!pkg) {
    return undefined;
  }
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  if (deps["next"]) return "Next.js";
  if (deps["react"]) return "React";
  if (deps["vue"]) return "Vue";
  if (deps["@angular/core"]) return "Angular";
  if (deps["express"]) return "Express";
  if (deps["fastify"]) return "Fastify";
  if (deps["@nestjs/core"]) return "NestJS";
  if (deps["django"]) return "Django";
  if (deps["flask"]) return "Flask";
  if (pkg.engines && (pkg as { name?: string }).name?.includes("vscode")) {
    return "VS Code Extension";
  }
  return undefined;
}

function listTopFolders(root: string, max = 20): string[] {
  const result: string[] = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
        continue;
      }
      result.push(entry.name + "/");
      if (result.length >= max) {
        break;
      }
    }
  } catch {
    // ignore
  }
  return result.sort();
}

function findEnvFiles(root: string): string[] {
  const found: string[] = [];
  const candidates = [".env", ".env.local", ".env.example", ".env.development"];
  for (const c of candidates) {
    if (fs.existsSync(path.join(root, c))) {
      found.push(c);
    }
  }
  return found;
}

function detectApis(root: string, pkg: Record<string, unknown> | undefined): string[] {
  const apis: string[] = [];
  const apiDirs = ["api", "pages/api", "src/api", "routes", "app/api"];
  for (const d of apiDirs) {
    if (fs.existsSync(path.join(root, d))) {
      apis.push(d + "/");
    }
  }
  const deps = pkg?.dependencies as Record<string, string> | undefined;
  if (deps?.["@supabase/supabase-js"]) apis.push("Supabase client");
  if (deps?.["prisma"] || deps?.["@prisma/client"]) apis.push("Prisma ORM");
  return apis;
}

function detectDatabase(pkg: Record<string, unknown> | undefined): string | undefined {
  const deps = {
    ...(pkg?.dependencies as Record<string, string> | undefined),
    ...(pkg?.devDependencies as Record<string, string> | undefined),
  };
  if (deps?.["pg"] || deps?.["postgres"]) return "PostgreSQL";
  if (deps?.["mysql2"]) return "MySQL";
  if (deps?.["mongodb"]) return "MongoDB";
  if (deps?.["sqlite3"] || deps?.["better-sqlite3"]) return "SQLite";
  if (deps?.["@prisma/client"]) return "Prisma";
  if (deps?.["@supabase/supabase-js"]) return "Supabase";
  return undefined;
}

export async function analyzeProject(root: string): Promise<ProjectUnderstanding> {
  const pkgPath = path.join(root, "package.json");
  const pkg = fs.existsSync(pkgPath) ? readJsonSafe<Record<string, unknown>>(pkgPath) : undefined;

  const dependencies: string[] = [];
  if (pkg) {
    const prod = Object.keys((pkg.dependencies as Record<string, string>) ?? {});
    const dev = Object.keys((pkg.devDependencies as Record<string, string>) ?? {});
    dependencies.push(...prod.slice(0, 15), ...dev.slice(0, 5));
  }

  const framework = detectFramework(pkg);
  const folderStructure = listTopFolders(root);
  const envFiles = findEnvFiles(root);
  const apis = detectApis(root, pkg);
  const database = detectDatabase(pkg);

  const components: string[] = [];
  if (fs.existsSync(path.join(root, "src"))) components.push("src/");
  if (fs.existsSync(path.join(root, "extensions"))) components.push("extensions/");
  if (fs.existsSync(path.join(root, "scripts"))) components.push("scripts/");
  if (fs.existsSync(path.join(root, "docs"))) components.push("docs/");
  if (fs.existsSync(path.join(root, ".editcore"))) components.push(".editcore/");

  const risks: string[] = [];
  if (envFiles.some((f) => f === ".env")) {
    risks.push("Archivo .env presente — no commitear secretos");
  }
  if (!fs.existsSync(path.join(root, ".git"))) {
    risks.push("No es repositorio git — sin historial ni reversión");
  }
  if (dependencies.length === 0) {
    risks.push("Sin package.json o dependencias detectadas");
  }

  const recommendations: string[] = [
    "Crear rama editcore/work-* antes de cambios importantes",
    "Ejecutar tests tras cada modificación",
    "Documentar decisiones en .editcore/docs/",
  ];
  if (framework === "VS Code Extension") {
    recommendations.push("Compilar con npm run compile antes de deploy portable");
  }

  const summary = [
    framework ? "Proyecto " + framework : "Proyecto de software",
    dependencies.length ? dependencies.length + " dependencias detectadas" : "sin dependencias npm",
    database ? "BD: " + database : "sin BD detectada",
    apis.length ? apis.length + " área(s) API" : "sin APIs obvias",
  ].join(" · ");

  return {
    summary,
    framework,
    dependencies: [...new Set(dependencies)].slice(0, 20),
    folderStructure,
    envFiles,
    apis,
    database,
    components,
    risks,
    recommendations,
  };
}

export function formatProjectUnderstandingMarkdown(u: ProjectUnderstanding): string {
  const lines = [
    "# PROJECT_UNDERSTANDING",
    "",
    "_EditCore Autonomous Developer Engine — análisis automático_",
    "",
    "**Generado:** " + new Date().toISOString(),
    "",
    "## Resumen técnico",
    "",
    u.summary,
    "",
    "## Framework",
    "",
    u.framework ?? "_No detectado_",
    "",
    "## Estructura de carpetas (nivel 1)",
    "",
    ...u.folderStructure.map((f) => "- `" + f + "`"),
    "",
    "## Componentes principales",
    "",
    ...u.components.map((c) => "- `" + c + "`"),
    "",
    "## Dependencias clave",
    "",
    ...(u.dependencies.length
      ? u.dependencies.map((d) => "- " + d)
      : ["_Ninguna detectada_"]),
    "",
    "## Base de datos",
    "",
    u.database ?? "_No detectada_",
    "",
    "## APIs",
    "",
    ...(u.apis.length ? u.apis.map((a) => "- " + a) : ["_Ninguna detectada_"]),
    "",
    "## Variables de entorno (archivos)",
    "",
    ...(u.envFiles.length ? u.envFiles.map((e) => "- `" + e + "`") : ["_Ningún .env detectado_"]),
    "",
    "## Riesgos",
    "",
    ...u.risks.map((r) => "- " + r),
    "",
    "## Recomendaciones",
    "",
    ...u.recommendations.map((r) => "- " + r),
  ];
  return lines.join("\n");
}

export async function writeProjectUnderstanding(
  root: string,
  understanding: ProjectUnderstanding
): Promise<string> {
  const md = formatProjectUnderstandingMarkdown(understanding);
  const editcoreDir = path.join(root, ".editcore", "docs");
  await fs.promises.mkdir(editcoreDir, { recursive: true });
  const editcorePath = path.join(editcoreDir, "PROJECT_UNDERSTANDING.md");
  await fs.promises.writeFile(editcorePath, md + "\n", "utf8");

  const isDev = fs.existsSync(path.join(root, "extensions", "editcore-claude", "package.json"));
  if (isDev) {
    const docsDir = path.join(root, "docs");
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.writeFile(path.join(docsDir, "PROJECT_UNDERSTANDING.md"), md + "\n", "utf8");
  }

  return editcorePath;
}
