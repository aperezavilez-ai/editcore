/**
 * Usuarios, equipos y organizaciones — Fase 1 (Prompt 6).
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { EditCorePlan } from "../enterprise/orgConfig";
import { appendAudit } from "../enterprise/orgConfig";
import type { Organization, TeamMember, TeamRole } from "./types";

const ORG_FILE = path.join(".editcore", "org.json");

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function orgIdFromPath(root: string): string {
  return "org-" + Buffer.from(root.toLowerCase()).toString("base64url").slice(0, 16);
}

export async function loadOrganization(): Promise<Organization | undefined> {
  const root = workspaceRoot();
  if (!root) return undefined;
  const p = path.join(root, ORG_FILE);
  if (!fs.existsSync(p)) return undefined;
  try {
    const raw = JSON.parse(await fs.promises.readFile(p, "utf8")) as Record<string, unknown>;
    return normalizeOrg(raw, root);
  } catch {
    return undefined;
  }
}

function normalizeOrg(raw: Record<string, unknown>, root: string): Organization {
  const members = Array.isArray(raw.members)
    ? (raw.members as Array<Record<string, unknown>>).map((m, i) => ({
        id: String(m.id ?? "mem-" + i),
        email: String(m.email ?? "user@local"),
        name: m.name ? String(m.name) : undefined,
        role: (m.role as TeamRole) ?? "developer",
        joinedAt: String(m.joinedAt ?? new Date().toISOString()),
      }))
    : [{ id: "mem-0", email: "owner@local", role: "owner" as TeamRole, joinedAt: new Date().toISOString() }];

  return {
    id: String(raw.id ?? orgIdFromPath(root)),
    name: String(raw.name ?? path.basename(root)),
    type: (raw.type as Organization["type"]) ?? "team",
    plan: (raw.plan as EditCorePlan) ?? "free",
    members,
    sharedAgents: Array.isArray(raw.sharedAgents) ? (raw.sharedAgents as string[]) : [],
    sharedTemplates: Array.isArray(raw.sharedTemplates) ? (raw.sharedTemplates as string[]) : [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export async function saveOrganization(org: Organization): Promise<void> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  const p = path.join(root, ORG_FILE);
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, JSON.stringify(org, null, 2) + "\n", "utf8");
  await appendAudit({ event: "org_updated", orgId: org.id, members: org.members.length });
}

export async function addTeamMember(email: string, role: TeamRole, name?: string): Promise<TeamMember> {
  const org = (await loadOrganization()) ?? (await createDefaultOrganization());
  const member: TeamMember = {
    id: "mem-" + Date.now(),
    email,
    name,
    role,
    joinedAt: new Date().toISOString(),
  };
  org.members.push(member);
  await saveOrganization(org);
  return member;
}

export async function createDefaultOrganization(): Promise<Organization> {
  const root = workspaceRoot();
  if (!root) throw new Error("Sin workspace.");
  const plan = vscode.workspace.getConfiguration("editcore").get<EditCorePlan>("plan", "free");
  const org: Organization = {
    id: orgIdFromPath(root),
    name: path.basename(root),
    type: "team",
    plan,
    members: [{ id: "mem-owner", email: "owner@local", role: "owner", joinedAt: new Date().toISOString() }],
    sharedAgents: [],
    sharedTemplates: [],
    createdAt: new Date().toISOString(),
  };
  await saveOrganization(org);
  return org;
}

export async function getCurrentUserRole(): Promise<TeamRole> {
  const org = await loadOrganization();
  return org?.members[0]?.role ?? "owner";
}

export async function shareAgentWithTeam(agentId: string): Promise<void> {
  const org = (await loadOrganization()) ?? (await createDefaultOrganization());
  if (!org.sharedAgents.includes(agentId)) {
    org.sharedAgents.push(agentId);
    await saveOrganization(org);
  }
}
