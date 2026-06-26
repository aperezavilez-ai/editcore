import * as vscode from 'vscode';
import {
  activateLicenseKey,
  clearLicense,
  getLicenseState,
  useCommunityEdition,
  generateDevLicenseKey,
} from './licenseService';
import { checkForUpdates } from './updateChecker';
import {
  DOWNLOAD_PAGE_URL,
  getExtensionVersion,
  PRODUCT_NAME,
  RELEASES_URL,
  SUPPORT_ISSUES_URL,
} from './productVersion';

export function registerProductCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('editcore.checkForUpdates', async () => {
      await checkForUpdates(context, { silent: false });
    }),

    vscode.commands.registerCommand('editcore.openDownloadPage', async () => {
      await vscode.env.openExternal(vscode.Uri.parse(DOWNLOAD_PAGE_URL));
    }),

    vscode.commands.registerCommand('editcore.activateLicense', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: 'Usar edición comunidad (gratis)', action: 'community' as const },
          { label: 'Activar clave de licencia', action: 'key' as const },
          { label: 'Quitar licencia guardada', action: 'clear' as const },
        ],
        { placeHolder: 'Licencia EditCore — precios y planes se configurarán después' }
      );
      if (!choice) return;

      if (choice.action === 'community') {
        await useCommunityEdition(context);
        vscode.window.showInformationMessage('EditCore: edición comunidad activa. Todas las funciones actuales disponibles.');
        return;
      }
      if (choice.action === 'clear') {
        await clearLicense(context);
        vscode.window.showInformationMessage('Licencia eliminada. Sigues en edición comunidad.');
        return;
      }

      const key = await vscode.window.showInputBox({
        prompt: 'Clave de licencia EditCore (formato EC-XXXX-XXXX-XXXX-XXXX)',
        placeHolder: 'EC-AB12-CD34-EF56-GH78',
        ignoreFocusOut: true,
      });
      if (!key) return;

      const result = await activateLicenseKey(context, key);
      if (!result.ok) {
        await vscode.window.showErrorMessage(result.error ?? 'Clave inválida', { modal: true });
        return;
      }
      vscode.window.showInformationMessage('EditCore: licencia activada correctamente.');
    }),

    vscode.commands.registerCommand('editcore.productHealth', async () => {
      const version = getExtensionVersion();
      const license = await getLicenseState(context);
      const update = await checkForUpdates(context, { silent: true });
      const lines = [
        `# ${PRODUCT_NAME} — Estado del producto`,
        '',
        `| Campo | Valor |`,
        `|-------|-------|`,
        `| Versión | ${version} |`,
        `| Licencia | ${license.label} |`,
        `| Actualización | ${update.updateAvailable ? `Disponible ${update.latest}` : 'Al día'} |`,
        `| Descargas | ${DOWNLOAD_PAGE_URL} |`,
        `| Soporte | ${SUPPORT_ISSUES_URL} |`,
        '',
        '## Comandos útiles',
        '- `EditCore: Buscar actualizaciones`',
        '- `EditCore: Activar licencia`',
        '- `EditCore: Autodiagnóstico` (Ctrl+Alt+D)',
        '',
        '_Los precios y la facturación online se añadirán en una fase posterior._',
      ];
      const doc = await vscode.workspace.openTextDocument({
        content: lines.join('\n'),
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    }),

    vscode.commands.registerCommand('editcore.generateDevLicense', async () => {
      const key = generateDevLicenseKey();
      await vscode.env.clipboard.writeText(key);
      vscode.window.showInformationMessage(`Clave de desarrollo copiada: ${key}`);
    })
  );
}
