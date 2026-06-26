import * as vscode from 'vscode';
import { useCommunityEdition } from '../product/licenseService';
import { DOWNLOAD_PAGE_URL } from '../product/productVersion';

const FIRST_RUN_KEY = 'editcore.firstRun.v1';

export async function runFirstRunWizardIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(FIRST_RUN_KEY)) {
    return;
  }

  const start = await vscode.window.showInformationMessage(
    'Bienvenido a EditCore IDE. ¿Quieres el tour rápido de configuración?',
    'Sí, empezar',
    'Saltar'
  );
  if (start !== 'Sí, empezar') {
    await useCommunityEdition(context);
    await context.globalState.update(FIRST_RUN_KEY, true);
    return;
  }

  const steps = [
    {
      label: '$(key) Configurar API de Claude/OpenAI',
      description: 'Necesaria para chat y agentes',
      action: async () => {
        try {
          await vscode.commands.executeCommand('editcoreConnect.openApis');
        } catch {
          await vscode.commands.executeCommand('editcore.openAccountPanel');
        }
      },
    },
    {
      label: '$(cloud) Conectar Vercel y Supabase',
      description: 'Panel EditCore Connect — opcional',
      action: async () => {
        await vscode.commands.executeCommand('workbench.view.extension.editcore-connect-sidebar');
      },
    },
    {
      label: '$(github) Iniciar sesión en GitHub',
      description: 'Repos, issues y deploy',
      action: async () => {
        await vscode.commands.executeCommand('editcoreConnect.signInGithub');
      },
    },
    {
      label: '$(pass) Licencia — edición comunidad',
      description: 'Gratis al descargar; claves de pago más adelante',
      action: async () => {
        await useCommunityEdition(context);
      },
    },
    {
      label: '$(book) Ver página de descarga y soporte',
      action: async () => {
        await vscode.env.openExternal(vscode.Uri.parse(DOWNLOAD_PAGE_URL));
      },
    },
  ];

  for (const step of steps) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: step.label, description: step.description, run: true },
        { label: '$(arrow-right) Siguiente', run: false },
        { label: '$(close) Terminar tour', run: 'done' as const },
      ],
      {
        placeHolder: step.description ?? step.label,
        title: 'EditCore — configuración inicial',
      }
    );
    if (!pick) break;
    if (pick.run === 'done') break;
    if (pick.run === true) {
      await step.action();
    }
  }

  await useCommunityEdition(context);
  await context.globalState.update(FIRST_RUN_KEY, true);
  vscode.window.showInformationMessage(
    'EditCore listo. Abre un proyecto o usa el chat con @claude.',
    'Abrir proyecto'
  ).then((c) => {
    if (c === 'Abrir proyecto') void vscode.commands.executeCommand('workbench.action.files.openFolder');
  });
}
