import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const execAsync = promisify(exec);

export interface ValidationResult {
  command: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface ValidationReport {
  ranAt: string;
  results: ValidationResult[];
  allPassed: boolean;
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function detectValidationCommands(root: string): string[] {
  const config = vscode.workspace.getConfiguration("editcore");
  const custom = config.get<string[]>("validation.commands", []);
  if (custom.length > 0) return custom;

  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) return [];

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    const cmds: string[] = [];
    if (pkg.scripts?.build) cmds.push("npm run build");
    if (pkg.scripts?.test) cmds.push("npm test");
    if (pkg.scripts?.lint && cmds.length < 2) cmds.push("npm run lint");
    return cmds;
  } catch {
    return [];
  }
}

async function runCommand(cwd: string, command: string): Promise<ValidationResult> {
  const t0 = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return {
      command,
      success: true,
      output: `${stdout}\n${stderr}`.trim().slice(-4000),
      durationMs: Date.now() - t0,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      command,
      success: false,
      output: `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`.trim().slice(-4000),
      durationMs: Date.now() - t0,
    };
  }
}

export function isPostChangeValidationEnabled(): boolean {
  return vscode.workspace.getConfiguration("editcore").get<boolean>("validation.afterAgent", true);
}

export async function runPostChangeValidation(): Promise<ValidationReport | undefined> {
  if (!isPostChangeValidationEnabled()) return undefined;

  const root = getWorkspaceRoot();
  if (!root) return undefined;

  const commands = detectValidationCommands(root);
  if (commands.length === 0) return undefined;

  const results: ValidationResult[] = [];
  for (const cmd of commands) {
    const result = await runCommand(root, cmd);
    results.push(result);
    if (!result.success) break;
  }

  return {
    ranAt: new Date().toISOString(),
    results,
    allPassed: results.every((r) => r.success),
  };
}

export function formatValidationMarkdown(report: ValidationReport): string {
  const lines = [
    `# Validación post-cambio`,
    `**Fecha:** ${report.ranAt}`,
    `**Resultado:** ${report.allPassed ? "OK" : "FALLÓ"}`,
    ``,
  ];
  for (const r of report.results) {
    lines.push(`## \`${r.command}\` — ${r.success ? "OK" : "ERROR"} (${r.durationMs}ms)`);
    lines.push("```");
    lines.push(r.output.slice(-2000));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

export async function saveValidationReport(report: ValidationReport): Promise<string | undefined> {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  const dir = path.join(root, ".editcore", "reports");
  await fs.promises.mkdir(dir, { recursive: true });
  const stamp = report.ranAt.replace(/[:.]/g, "-");
  const filePath = path.join(dir, `validation-${stamp}.md`);
  await fs.promises.writeFile(filePath, formatValidationMarkdown(report), "utf8");
  return filePath;
}
