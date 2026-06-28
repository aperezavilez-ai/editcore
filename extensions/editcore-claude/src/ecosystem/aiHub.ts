/**
 * EDITCORE AI HUB — Fase 10 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { appendAudit } from "../enterprise/orgConfig";
import type { AiHubItem } from "./types";

const HUB_FILE = path.join(".editcore", "ai-hub", "items.json");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function loadHub(): Promise<AiHubItem[]> {
  const root = workspaceRoot();
  if (!root) return [];
  const file = path.join(root, HUB_FILE);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8")) as AiHubItem[];
  } catch {
    return [];
  }
}

async function saveHub(items: AiHubItem[]): Promise<void> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  const dir = path.dirname(path.join(root, HUB_FILE));
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(root, HUB_FILE), JSON.stringify(items.slice(0, 500), null, 2) + "\n", "utf8");
}

export async function saveHubItem(input: Omit<AiHubItem, "id" | "createdAt" | "updatedAt" | "rating" | "usageCount"> & { id?: string }): Promise<AiHubItem> {
  const items = await loadHub();
  const now = new Date().toISOString();
  const id = input.id ?? "hub-" + Date.now();
  const existing = items.findIndex((i) => i.id === id);
  const item: AiHubItem = {
    ...input,
    id,
    rating: existing >= 0 ? items[existing].rating : 0,
    usageCount: existing >= 0 ? items[existing].usageCount : 0,
    createdAt: existing >= 0 ? items[existing].createdAt : now,
    updatedAt: now,
  };
  if (existing >= 0) items[existing] = item;
  else items.unshift(item);
  await saveHub(items);
  await appendAudit({ event: "ai_hub_save", itemId: id, kind: item.kind });
  return item;
}

export async function listHubItems(kind?: AiHubItem["kind"]): Promise<AiHubItem[]> {
  const items = await loadHub();
  return kind ? items.filter((i) => i.kind === kind) : items;
}

export async function duplicateHubItem(id: string): Promise<AiHubItem | undefined> {
  const items = await loadHub();
  const src = items.find((i) => i.id === id);
  if (!src) return undefined;
  return saveHubItem({
    ...src,
    id: undefined,
    title: src.title + " (copia)",
    visibility: "private",
    author: "user",
  });
}

export async function rateHubItem(id: string, rating: number): Promise<void> {
  const items = await loadHub();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.rating = Math.min(5, Math.max(0, rating));
  await saveHub(items);
}

export async function incrementHubUsage(id: string): Promise<void> {
  const items = await loadHub();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.usageCount++;
  await saveHub(items);
}

export async function deleteHubItem(id: string): Promise<boolean> {
  const items = await loadHub();
  const filtered = items.filter((i) => i.id !== id);
  if (filtered.length === items.length) return false;
  await saveHub(filtered);
  return true;
}

export async function searchHubItems(query: string): Promise<AiHubItem[]> {
  const q = query.toLowerCase();
  return (await loadHub()).filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
  );
}
