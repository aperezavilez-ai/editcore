import type { HealthReport, SystemSnapshot } from "./types";

export function buildLocalAnalysis(
  snapshot: SystemSnapshot,
  health: HealthReport
): string {
  const lines: string[] = [
    "## Resumen ejecutivo (local, sin API)",
    "",
    `EditCore **v${snapshot.productVersion}** (extensión ${snapshot.extensionVersion}) está **${health.status}**.`,
    "",
    "### Hallazgos",
    "",
  ];

  const issues = health.findings.filter((f) => f.severity !== "ok").slice(0, 8);
  if (issues.length === 0) {
    lines.push("- Sin hallazgos críticos en checks locales.");
  } else {
    for (const f of issues) {
      lines.push(`- **${f.severity}** — ${f.title}: ${f.message}`);
    }
  }

  lines.push("", "### Integraciones", "");
  for (const i of snapshot.integrations) {
    lines.push(`- ${i.configured ? "✅" : "⚪"} ${i.label}${i.detail ? ` (${i.detail})` : ""}`);
  }

  lines.push("", "### Recomendaciones", "");
  if (!snapshot.apiKeys.hasAnthropic && !snapshot.apiKeys.hasOpenAi) {
    lines.push("- Configura API Key en el panel de APIs.");
  }
  if (health.status === "critical") {
    lines.push("- Revisa el Health Monitor y corrige hallazgos críticos antes de usar el agente.");
  }
  if (health.mcp.configuredServers > 0 && health.mcp.connectedServers === 0) {
    lines.push("- MCP configurado pero sin conexión; revisa `.editcore/mcp.json`.");
  }
  lines.push(
    "- Para ejecutar mejoras reales: `editcore.autonomy.diagnose` o escribe «modo automejora» en el chat.",
    "- Prompts listos para Cursor: `.editcore/autonomy/cursor-prompts.md`"
  );

  return lines.join("\n");
}

export function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("límite de uso") || msg.includes("rate") || msg.includes("429");
  }
  return false;
}
