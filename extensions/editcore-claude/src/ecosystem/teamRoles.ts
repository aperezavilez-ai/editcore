/**
 * Roles de equipo y permisos — Fase 2 (Prompt 6).
 */
import type { TeamPermission, TeamRole } from "./types";

export const TEAM_ROLES: Array<{ id: TeamRole; label: string; description: string }> = [
  { id: "owner", label: "Owner", description: "Control total de la organización" },
  { id: "admin", label: "Administrador", description: "Gestión de usuarios y recursos" },
  { id: "developer", label: "Developer", description: "Código y agentes" },
  { id: "reviewer", label: "Reviewer", description: "Revisión y comentarios" },
  { id: "client", label: "Cliente", description: "Solo proyectos asignados" },
  { id: "readonly", label: "Solo lectura", description: "Ver sin modificar" },
];

export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  owner: [
    "view_projects",
    "edit_code",
    "run_agents",
    "manage_apis",
    "manage_users",
    "manage_marketplace",
    "view_analytics",
  ],
  admin: [
    "view_projects",
    "edit_code",
    "run_agents",
    "manage_apis",
    "manage_users",
    "manage_marketplace",
    "view_analytics",
  ],
  developer: ["view_projects", "edit_code", "run_agents", "manage_apis"],
  reviewer: ["view_projects", "run_agents"],
  client: ["view_projects"],
  readonly: ["view_projects"],
};

export function roleHasPermission(role: TeamRole, permission: TeamPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function formatPermissionsMarkdown(): string {
  const lines = ["# Permisos por rol", "", "| Rol | Permisos |", "|-----|----------|"];
  for (const r of TEAM_ROLES) {
    lines.push("| " + r.label + " | " + ROLE_PERMISSIONS[r.id].join(", ") + " |");
  }
  return lines.join("\n");
}
