/**
 * Tipos — EDITCORE Marketplace & Team Collaboration (Prompt 6).
 */

export type TeamRole = "owner" | "admin" | "developer" | "reviewer" | "client" | "readonly";

export type TeamPermission =
  | "view_projects"
  | "edit_code"
  | "run_agents"
  | "manage_apis"
  | "manage_users"
  | "manage_marketplace"
  | "view_analytics";

export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role: TeamRole;
  joinedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  type: "individual" | "team" | "company" | "enterprise";
  plan: import("../enterprise/orgConfig").EditCorePlan;
  members: TeamMember[];
  sharedAgents: string[];
  sharedTemplates: string[];
  createdAt: string;
}

export interface CustomAgentDefinition {
  id: string;
  name: string;
  objective: string;
  model: "auto" | "anthropic" | "openai";
  modelId?: string;
  tools: string[];
  permissions: TeamPermission[];
  memoryEnabled: boolean;
  instructions: string;
  workflow?: string[];
  visibility: "private" | "team" | "public";
  author: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiHubItem {
  id: string;
  kind: "prompt" | "agent" | "template" | "flow" | "doc";
  title: string;
  content: string;
  tags: string[];
  visibility: "private" | "team" | "public";
  rating: number;
  usageCount: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  entry?: string;
  connectors?: string[];
}

export interface CollaborationComment {
  id: string;
  at: string;
  author: string;
  target: string;
  text: string;
}

export interface ActivityEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface UsageMetrics {
  projectsCreated: number;
  agentsUsed: number;
  tasksCompleted: number;
  aiTokensEstimate: number;
  timeSavedMinutes: number;
  lastUpdated: string;
}

export interface VersionSnapshot {
  id: string;
  label: string;
  at: string;
  gitCommit?: string;
  files: string[];
  note?: string;
}
