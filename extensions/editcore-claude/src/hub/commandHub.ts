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
