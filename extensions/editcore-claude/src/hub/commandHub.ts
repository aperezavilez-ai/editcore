import * as vscode from 'vscode';

interface HubItem {
  label: string;
  description?: string;
  command: string;
  args?: unknown[];
}

const HUB_SECTIONS: Array<{ section: string; items: HubItem[] }> = [
  {
    section: 'Chat & Agente',
    items: [
      { label: 'Abrir chat @claude', command: 'editcore.openChat' },
      { label: 'Modo Fundador', command: 'editcore.founderMode' },
      { label: 'Modo CTO', command: 'editcore.ctoMode' },
      { label: 'SaaS Builder', command: 'editcore.saasBuilder' },
      { label: 'GPS Builder', command: 'editcore.gpsBuilder' },
      { label: 'Abrir Agente (panel)', command: 'editcore.openAgent' },
    ],
  },
  {
    section: 'Plataforma',
    items: [
      { label: 'Autodiagnóstico', command: 'editcore.selfDiagnostic' },
      { label: 'Autodiagnóstico rápido (sin Claude)', command: 'editcore.selfDiagnostic.quick' },
      { label: 'Autonomía real (diagnóstico + tareas)', command: 'editcore.autonomy.diagnose' },
      { label: 'Nivel de autonomía (1–5)', command: 'editcore.autonomy.setLevel' },
      { label: 'Generar PLAN implementación', command: 'editcore.evolution.generatePlan' },
      { label: 'Ejecutar fase roadmap (1–10)', command: 'editcore.evolution.runPhase' },
      { label: 'AI Orchestrator (AOS)', command: 'editcore.aos.run' },
      { label: 'Plan de trabajo', command: 'editcore.aos.generateWorkPlan' },
      { label: 'Evolution Manager', command: 'editcore.aos.evolutionManager' },
      { label: 'Docs AOS (arquitectura)', command: 'editcore.aos.generateDocs' },
      { label: 'Desarrollador autónomo (ADE)', command: 'editcore.autonomous.run' },
      { label: 'Analizar proyecto', command: 'editcore.autonomous.analyzeProject' },
      { label: 'Plan autónomo', command: 'editcore.autonomous.generatePlan' },
      { label: 'Historial tareas autónomas', command: 'editcore.autonomous.openWorkbench' },
      { label: 'Modo copiloto / autónomo', command: 'editcore.autonomous.setMode' },
      { label: 'Ver diff git (ADE)', command: 'editcore.autonomous.showDiff' },
      { label: 'SIGUIENTE_PROMPT 5', command: 'editcore.autonomous.openNextPrompt' },
      { label: 'Knowledge Center', command: 'editcore.knowledge.openCenter' },
      { label: 'Reindexar conocimiento', command: 'editcore.knowledge.reindex' },
      { label: 'Buscar conocimiento', command: 'editcore.knowledge.search' },
      { label: 'SIGUIENTE_PROMPT 6', command: 'editcore.knowledge.openNextPrompt' },
      { label: 'Ciclo de evolución completo', command: 'editcore.evolution.cycle' },
      { label: 'Ejecutar tarea de autonomía', command: 'editcore.autonomy.execute' },
      { label: 'AI Hub', command: 'editcore.ecosystem.openAiHub' },
      { label: 'Marketplace (panel)', command: 'editcore.ecosystem.openMarketplace' },
      { label: 'Agent Builder', command: 'editcore.ecosystem.agentBuilder' },
      { label: 'Template Library', command: 'editcore.ecosystem.templates' },
      { label: 'Equipo y roles', command: 'editcore.ecosystem.manageTeam' },
      { label: 'Analítica ecosistema', command: 'editcore.ecosystem.analytics' },
      { label: 'SIGUIENTE_PROMPT 7', command: 'editcore.ecosystem.openNextPrompt' },
      { label: 'Marketplace', command: 'editcore.openMarketplace' },
      { label: 'Cuenta & API', command: 'editcore.openAccountPanel' },
      { label: 'Inicializar .editcore', command: 'editcore.initWorkspace' },
      { label: 'Sesiones de agente', command: 'editcore.showSessions' },
      { label: 'Reanudar sesión', command: 'editcore.resumeSession' },
      { label: 'Audit log', command: 'editcore.showAuditLog' },
    ],
  },
  {
    section: 'Ops & DevOps',
    items: [
      { label: 'Sala de guerra', command: 'editcore.warRoom' },
      { label: 'Deploy autónomo', command: 'editcore.deployAutonomous' },
      { label: 'Gemelo digital', command: 'editcore.updateDigitalTwin' },
      { label: 'Reconectar MCP', command: 'editcore.refreshMcp' },
      { label: 'EditCore Connect', command: 'workbench.view.extension.editcore-connect-sidebar' },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { label: 'Reindexar codebase', command: 'editcore.reindexWorkspace' },
      { label: 'Construir índice RAG', command: 'editcore.buildRagIndex' },
      { label: 'Acerca de EditCore', command: 'editcore.about' },
      { label: 'Exportar sesiones', command: 'editcore.exportSessions' },
    ],
  },
];

export async function showCommandHub(): Promise<void> {
  const picks = HUB_SECTIONS.flatMap((sec) =>
    sec.items.map((item) => ({
      label: `$(${iconFor(item.command)}) ${item.label}`,
      description: sec.section,
      item,
    }))
  );

  const pick = await vscode.window.showQuickPick(picks, {
    placeHolder: 'EditCore Command Hub — elegí una acción',
    matchOnDescription: true,
  });
  if (!pick) return;

  await vscode.commands.executeCommand(pick.item.command, ...(pick.item.args ?? []));
}

function iconFor(command: string): string {
  if (command.includes('Chat') || command.includes('founder') || command.includes('cto')) return 'comment';
  if (command.includes('Marketplace')) return 'extensions';
  if (command.includes('Diagnostic') || command.includes('selfDiagnostic')) return 'pulse';
  if (command.includes('war') || command.includes('deploy')) return 'rocket';
  return 'sparkle';
}
