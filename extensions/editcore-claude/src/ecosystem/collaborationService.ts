/**
 * Colaboración en equipo — Fase 8 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ActivityEvent, CollaborationComment } from "./types";

const COLLAB_DIR = path.join(".editcore", "collaboration");
const COMMENTS_FILE = "comments.jsonl";
const ACTIVITY_FILE = "activity.jsonl";
const NOTIFICATIONS_FILE = "notifications.json";

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function ensureDir(root: string): Promise<string> {
  const dir = path.join(root, COLLAB_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

export async function addComment(target: string, text: string, author = "local"): Promise<CollaborationComment> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  const comment: CollaborationComment = {
    id: "cmt-" + Date.now(),
    at: new Date().toISOString(),
    author,
    target,
    text: text.slice(0, 2000),
  };
  const dir = await ensureDir(root);
  await fs.promises.appendFile(path.join(dir, COMMENTS_FILE), JSON.stringify(comment) + "\n", "utf8");
  await recordActivity(author, "comment", "Comentario en " + target);
  return comment;
}

export async function listComments(target?: string, limit = 30): Promise<CollaborationComment[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const file = path.join(root, COLLAB_DIR, COMMENTS_FILE);
  if (!fs.existsSync(file)) return [];
  const lines = (await fs.promises.readFile(file, "utf8")).split("\n").filter(Boolean);
  const items: CollaborationComment[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      const c = JSON.parse(line) as CollaborationComment;
      if (!target || c.target === target) items.push(c);
    } catch {
      // skip
    }
  }
  return items.reverse();
}

export async function recordActivity(actor: string, action: string, detail: string): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  const event: ActivityEvent = {
    id: "act-" + Date.now(),
    at: new Date().toISOString(),
    actor,
    action,
    detail: detail.slice(0, 500),
  };
  const dir = await ensureDir(root);
  await fs.promises.appendFile(path.join(dir, ACTIVITY_FILE), JSON.stringify(event) + "\n", "utf8");
  await pushNotification(action, detail);
}

export async function listActivity(limit = 40): Promise<ActivityEvent[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const file = path.join(root, COLLAB_DIR, ACTIVITY_FILE);
  if (!fs.existsSync(file)) return [];
  const lines = (await fs.promises.readFile(file, "utf8")).split("\n").filter(Boolean);
  const items: ActivityEvent[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      items.push(JSON.parse(line) as ActivityEvent);
    } catch {
      // skip
    }
  }
  return items.reverse();
}

interface Notification {
  id: string;
  at: string;
  title: string;
  read: boolean;
}

async function pushNotification(title: string, body: string): Promise<void> {
  const root = workspaceRoot();
  if (!root) return;
  const file = path.join(root, COLLAB_DIR, NOTIFICATIONS_FILE);
  let list: Notification[] = [];
  if (fs.existsSync(file)) {
    try {
      list = JSON.parse(await fs.promises.readFile(file, "utf8")) as Notification[];
    } catch {
      list = [];
    }
  }
  list.unshift({
    id: "ntf-" + Date.now(),
    at: new Date().toISOString(),
    title: title + ": " + body.slice(0, 80),
    read: false,
  });
  if (list.length > 50) list = list.slice(0, 50);
  await fs.promises.writeFile(file, JSON.stringify(list, null, 2) + "\n", "utf8");
}

export async function listNotifications(): Promise<Notification[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const file = path.join(root, COLLAB_DIR, NOTIFICATIONS_FILE);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8")) as Notification[];
  } catch {
    return [];
  }
}

export function formatCollaborationMarkdown(): string {
  return [
    "# Colaboración EditCore",
    "",
    "Archivos en `.editcore/collaboration/`:",
    "- comments.jsonl — comentarios por archivo/tarea",
    "- activity.jsonl — historial de actividad del equipo",
    "- notifications.json — notificaciones locales",
  ].join("\n");
}
