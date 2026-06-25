import * as vscode from "vscode";
import { listSupabaseProjects, verifySupabaseToken } from "./api/supabaseApi";
import { validateSupabaseAccount } from "./supabaseAutoLink";

const LEGACY_SECRET = "supabaseToken";
const SECRET_PREFIX = "editcoreConnect.supabase.";
const REGISTRY_KEY = "editcoreConnect.supabaseAccounts";

export interface SupabaseAccountEntry {
  id: string;
  label: string;
  projectCount: number;
  addedAt: string;
}

export interface SupabaseAccountRegistry {
  version: 1;
  accounts: SupabaseAccountEntry[];
  /** Ruta normalizada del workspace → id de cuenta */
  workspaceAccountMap: Record<string, string>;
  defaultAccountId?: string;
}

function secretKey(accountId: string): string {
  return `${SECRET_PREFIX}${accountId}`;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

async function loadRegistry(context: vscode.ExtensionContext): Promise<SupabaseAccountRegistry> {
  const reg =
    context.globalState.get<SupabaseAccountRegistry>(REGISTRY_KEY) ?? {
      version: 1,
      accounts: [],
      workspaceAccountMap: {},
    };
  return reg;
}

async function saveRegistry(
  context: vscode.ExtensionContext,
  reg: SupabaseAccountRegistry
): Promise<void> {
  await context.globalState.update(REGISTRY_KEY, reg);
}

/** Migra el token único antiguo a la primera cuenta del registro. */
export async function migrateLegacySupabaseToken(context: vscode.ExtensionContext): Promise<void> {
  const reg = await loadRegistry(context);
  if (reg.accounts.length > 0) return;

  const legacy = await context.secrets.get(LEGACY_SECRET);
  if (!legacy?.trim()) return;

  const id = "default";
  await context.secrets.store(secretKey(id), legacy.trim());
  reg.accounts.push({
    id,
    label: "Cuenta principal",
    projectCount: (await listSupabaseProjects(legacy.trim())).length,
    addedAt: new Date().toISOString(),
  });
  reg.defaultAccountId = id;
  await saveRegistry(context, reg);
}

export async function listSupabaseAccounts(
  context: vscode.ExtensionContext
): Promise<SupabaseAccountEntry[]> {
  await migrateLegacySupabaseToken(context);
  const reg = await loadRegistry(context);
  const updated: SupabaseAccountEntry[] = [];
  for (const a of reg.accounts) {
    const token = await context.secrets.get(secretKey(a.id));
    if (!token) continue;
    const count = (await listSupabaseProjects(token)).length;
    updated.push({ ...a, projectCount: count });
  }
  if (updated.some((a, i) => a.projectCount !== reg.accounts[i]?.projectCount)) {
    reg.accounts = updated;
    await saveRegistry(context, reg);
  }
  return updated;
}

export async function hasSupabaseAccounts(context: vscode.ExtensionContext): Promise<boolean> {
  const accounts = await listSupabaseAccounts(context);
  return accounts.length > 0;
}

export async function getAccountToken(
  context: vscode.ExtensionContext,
  accountId: string
): Promise<string | undefined> {
  const fromStore = await context.secrets.get(secretKey(accountId));
  if (fromStore?.trim()) return fromStore.trim();
  if (accountId === "default") {
    const legacy = await context.secrets.get(LEGACY_SECRET);
    return legacy?.trim() || undefined;
  }
  return undefined;
}

export async function getWorkspaceAccountId(
  context: vscode.ExtensionContext,
  cwd: string
): Promise<string | undefined> {
  await migrateLegacySupabaseToken(context);
  const reg = await loadRegistry(context);
  return reg.workspaceAccountMap[normalizePath(cwd)] ?? reg.defaultAccountId;
}

export async function setWorkspaceAccount(
  context: vscode.ExtensionContext,
  cwd: string,
  accountId: string
): Promise<void> {
  const reg = await loadRegistry(context);
  reg.workspaceAccountMap[normalizePath(cwd)] = accountId;
  if (!reg.defaultAccountId) {
    reg.defaultAccountId = accountId;
  }
  await saveRegistry(context, reg);
}

export async function addSupabaseAccount(
  context: vscode.ExtensionContext,
  label: string,
  token: string
): Promise<{ ok: boolean; account?: SupabaseAccountEntry; error?: string }> {
  const trimmed = token.trim();
  const check = await verifySupabaseToken(trimmed);
  if (!check.ok) {
    return { ok: false, error: check.error ?? "Token de Supabase inválido." };
  }

  const projects = await listSupabaseProjects(trimmed);
  const reg = await loadRegistry(context);
  const id = `sb-${Date.now()}`;
  await context.secrets.store(secretKey(id), trimmed);

  const entry: SupabaseAccountEntry = {
    id,
    label: label.trim() || `Cuenta ${reg.accounts.length + 1}`,
    projectCount: projects.length,
    addedAt: new Date().toISOString(),
  };
  reg.accounts.push(entry);
  if (!reg.defaultAccountId) {
    reg.defaultAccountId = id;
  }
  await saveRegistry(context, reg);

  // Mantener compatibilidad con código que lee supabaseToken legacy
  await context.secrets.store(LEGACY_SECRET, trimmed);

  return { ok: true, account: entry };
}

export async function removeSupabaseAccount(
  context: vscode.ExtensionContext,
  accountId: string
): Promise<void> {
  const reg = await loadRegistry(context);
  reg.accounts = reg.accounts.filter((a) => a.id !== accountId);
  for (const [path, id] of Object.entries(reg.workspaceAccountMap)) {
    if (id === accountId) {
      delete reg.workspaceAccountMap[path];
    }
  }
  if (reg.defaultAccountId === accountId) {
    reg.defaultAccountId = reg.accounts[0]?.id;
  }
  await context.secrets.delete(secretKey(accountId));
  await saveRegistry(context, reg);

  const first = reg.accounts[0];
  if (first) {
    const t = await getAccountToken(context, first.id);
    if (t) await context.secrets.store(LEGACY_SECRET, t);
  } else {
    await context.secrets.delete(LEGACY_SECRET);
  }
}

export async function resolveSupabaseForWorkspace(
  context: vscode.ExtensionContext,
  cwd: string
): Promise<{ accountId: string; label: string; token: string } | undefined> {
  await migrateLegacySupabaseToken(context);
  const accounts = await listSupabaseAccounts(context);
  if (!accounts.length) return undefined;

  const mappedId = await getWorkspaceAccountId(context, cwd);
  if (mappedId) {
    const token = await getAccountToken(context, mappedId);
    const acc = accounts.find((a) => a.id === mappedId);
    if (token && acc) {
      return { accountId: mappedId, label: acc.label, token };
    }
  }

  const { getWorkspaceHints, scoreNameMatch } = await import("./workspaceHints");
  const { getSupabaseLinkRef, pickBestSupabaseProjectForHints } = await import("./supabaseAutoLink");
  const hints = await getWorkspaceHints(cwd);
  const existingRef = getSupabaseLinkRef(cwd);

  if (existingRef) {
    for (const acc of accounts) {
      const token = await getAccountToken(context, acc.id);
      if (!token) continue;
      const { projects } = await validateSupabaseAccount(token);
      if (projects.some((p) => p.id === existingRef)) {
        await setWorkspaceAccount(context, cwd, acc.id);
        await context.secrets.store(LEGACY_SECRET, token);
        return { accountId: acc.id, label: acc.label, token };
      }
    }
  }

  let best:
    | { accountId: string; label: string; token: string; score: number }
    | undefined;

  for (const acc of accounts) {
    const token = await getAccountToken(context, acc.id);
    if (!token) continue;
    const { ok, projects } = await validateSupabaseAccount(token);
    if (!ok) continue;
    const project = pickBestSupabaseProjectForHints(projects, hints.all);
    if (!project) continue;
    const score = scoreNameMatch(project.name, hints.all);
    if (!best || score > best.score) {
      best = { accountId: acc.id, label: acc.label, token, score };
    }
  }

  if (best && best.score >= 40) {
    await setWorkspaceAccount(context, cwd, best.accountId);
    await context.secrets.store(LEGACY_SECRET, best.token);
    return { accountId: best.accountId, label: best.label, token: best.token };
  }

  if (accounts.length === 1) {
    const token = await getAccountToken(context, accounts[0].id);
    if (token) {
      return { accountId: accounts[0].id, label: accounts[0].label, token };
    }
  }

  return undefined;
}

export async function getSupabaseTokenForWorkspace(
  context: vscode.ExtensionContext,
  cwd?: string
): Promise<string | undefined> {
  if (cwd) {
    const resolved = await resolveSupabaseForWorkspace(context, cwd);
    if (resolved) return resolved.token;
  }
  await migrateLegacySupabaseToken(context);
  const reg = await loadRegistry(context);
  const id = reg.defaultAccountId ?? reg.accounts[0]?.id;
  if (id) {
    return getAccountToken(context, id);
  }
  const legacy = await context.secrets.get(LEGACY_SECRET);
  return legacy?.trim() || undefined;
}

export async function pickSupabaseAccount(
  context: vscode.ExtensionContext,
  placeHolder: string
): Promise<SupabaseAccountEntry | undefined> {
  const accounts = await listSupabaseAccounts(context);
  if (!accounts.length) return undefined;
  const pick = await vscode.window.showQuickPick(
    accounts.map((a) => ({
      label: a.label,
      description: `${a.projectCount} proyecto(s)`,
      account: a,
    })),
    { placeHolder, title: "EditCore — cuentas Supabase" }
  );
  return pick?.account;
}

export async function manageSupabaseAccounts(
  context: vscode.ExtensionContext,
  onChange?: () => void
): Promise<void> {
  const accounts = await listSupabaseAccounts(context);

  type ManagePick =
    | { label: string; action: "add" }
    | { label: string; description: string; action: "select"; account: SupabaseAccountEntry };

  const items: ManagePick[] = [
    { label: "$(add) Añadir cuenta Supabase", action: "add" },
    ...accounts.map((a) => ({
      label: a.label,
      description: `${a.projectCount} proyectos`,
      action: "select" as const,
      account: a,
    })),
  ];

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: "Gestionar cuentas Supabase",
  });
  if (!pick) return;

  if (pick.action === "add") {
    await vscode.commands.executeCommand("editcoreConnect.addSupabaseAccount");
    onChange?.();
    return;
  }

  if (pick.action === "select") {
    const account = pick.account;
    const action = await vscode.window.showQuickPick(
      [
        { label: "Usar en esta carpeta", action: "workspace" as const },
        { label: "Cuenta por defecto (nuevas carpetas)", action: "default" as const },
        { label: "Eliminar cuenta", action: "remove" as const },
      ],
      { placeHolder: account.label }
    );
    if (!action) return;

    if (action.action === "workspace") {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        vscode.window.showWarningMessage("Abrí una carpeta de proyecto primero.");
        return;
      }
      await setWorkspaceAccount(context, cwd, account.id);
      const token = await getAccountToken(context, account.id);
      if (token) await context.secrets.store(LEGACY_SECRET, token);
      vscode.window.showInformationMessage(`Supabase: esta carpeta usará «${account.label}».`);
    } else if (action.action === "default") {
      const reg = await loadRegistry(context);
      reg.defaultAccountId = account.id;
      await saveRegistry(context, reg);
      const token = await getAccountToken(context, account.id);
      if (token) await context.secrets.store(LEGACY_SECRET, token);
      vscode.window.showInformationMessage(`Supabase: cuenta por defecto → ${account.label}`);
    } else if (action.action === "remove") {
      const ok = await vscode.window.showWarningMessage(
        `¿Eliminar «${account.label}» de EditCore?`,
        { modal: true },
        "Eliminar"
      );
      if (ok === "Eliminar") {
        await removeSupabaseAccount(context, account.id);
        vscode.window.showInformationMessage("Cuenta Supabase eliminada.");
      }
    }
    onChange?.();
  }
}
