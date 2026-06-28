/**
 * Sistema comercial — Fase 11 (Prompt 6).
 */
import * as vscode from "vscode";
import type { EditCorePlan } from "../enterprise/orgConfig";
import { getEffectivePlan, loadOrgConfig } from "../enterprise/orgConfig";

export interface PlanLimits {
  maxTeamMembers: number;
  maxCustomAgents: number;
  maxAiHubItems: number;
  marketplacePremium: boolean;
  privateAgents: boolean;
  publicAgents: boolean;
  analytics: boolean;
}

export const PLAN_LIMITS: Record<EditCorePlan, PlanLimits> = {
  free: {
    maxTeamMembers: 1,
    maxCustomAgents: 2,
    maxAiHubItems: 20,
    marketplacePremium: false,
    privateAgents: true,
    publicAgents: false,
    analytics: false,
  },
  pro: {
    maxTeamMembers: 3,
    maxCustomAgents: 10,
    maxAiHubItems: 100,
    marketplacePremium: true,
    privateAgents: true,
    publicAgents: true,
    analytics: true,
  },
  team: {
    maxTeamMembers: 10,
    maxCustomAgents: 25,
    maxAiHubItems: 250,
    marketplacePremium: true,
    privateAgents: true,
    publicAgents: true,
    analytics: true,
  },
  business: {
    maxTeamMembers: 50,
    maxCustomAgents: 100,
    maxAiHubItems: 1000,
    marketplacePremium: true,
    privateAgents: true,
    publicAgents: true,
    analytics: true,
  },
  enterprise: {
    maxTeamMembers: 999,
    maxCustomAgents: 999,
    maxAiHubItems: 9999,
    marketplacePremium: true,
    privateAgents: true,
    publicAgents: true,
    analytics: true,
  },
};

export async function getCurrentPlanLimits(): Promise<PlanLimits> {
  const plan = await getEffectivePlan();
  return PLAN_LIMITS[plan];
}

export async function checkPlanLimit(
  key: keyof PlanLimits,
  currentCount?: number
): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getEffectivePlan();
  const limits = PLAN_LIMITS[plan];

  if (key === "maxTeamMembers" && currentCount !== undefined) {
    if (currentCount >= limits.maxTeamMembers) {
      return { allowed: false, reason: "Límite de miembros del plan " + plan };
    }
  }
  if (key === "maxCustomAgents" && currentCount !== undefined) {
    if (currentCount >= limits.maxCustomAgents) {
      return { allowed: false, reason: "Límite de agentes personalizados" };
    }
  }
  if (key === "marketplacePremium" && !limits.marketplacePremium) {
    return { allowed: false, reason: "Ítems premium requieren plan pro+" };
  }
  if (key === "analytics" && !limits.analytics) {
    return { allowed: false, reason: "Analítica requiere plan pro+" };
  }

  return { allowed: true };
}

export async function formatPlanSummary(): Promise<string> {
  const plan = await getEffectivePlan();
  const org = await loadOrgConfig();
  const limits = PLAN_LIMITS[plan];
  return [
    "Plan: " + plan,
    "Organización: " + (org?.name ?? "local"),
    "Miembros máx: " + limits.maxTeamMembers,
    "Agentes custom máx: " + limits.maxCustomAgents,
    "Marketplace premium: " + (limits.marketplacePremium ? "sí" : "no"),
    "Analítica: " + (limits.analytics ? "sí" : "no"),
  ].join("\n");
}

export function getConfiguredPlan(): EditCorePlan {
  return vscode.workspace.getConfiguration("editcore").get<EditCorePlan>("plan", "free");
}
