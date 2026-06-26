import * as vscode from 'vscode';
import {
  compareSemver,
  DOWNLOAD_PAGE_URL,
  getExtensionVersion,
  RELEASES_URL,
  UPDATE_MANIFEST_URL,
} from './productVersion';

export interface UpdateManifest {
  version: string;
  productVersion?: string;
  publishedAt?: string;
  notes?: string;
  portable?: { name: string; url: string; sha256?: string };
  setup?: { name: string; url: string; sha256?: string };
}

const LAST_CHECK_KEY = 'editcore.lastUpdateCheck';
const SKIP_VERSION_KEY = 'editcore.skipUpdateVersion';

async function fetchManifest(): Promise<UpdateManifest | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(UPDATE_MANIFEST_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    return (await res.json()) as UpdateManifest;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdates(
  context: vscode.ExtensionContext,
  options: { silent?: boolean } = {}
): Promise<{ updateAvailable: boolean; current: string; latest?: string; manifest?: UpdateManifest }> {
  const current = getExtensionVersion();
  const manifest = await fetchManifest();
  await context.globalState.update(LAST_CHECK_KEY, new Date().toISOString());

  if (!manifest?.version) {
    if (!options.silent) {
      vscode.window.showWarningMessage(
        'No se pudo comprobar actualizaciones. Revisa tu conexión o la página de descargas.',
        'Abrir descargas'
      ).then((c) => {
        if (c === 'Abrir descargas') void vscode.env.openExternal(vscode.Uri.parse(DOWNLOAD_PAGE_URL));
      });
    }
    return { updateAvailable: false, current };
  }

  const skipped = context.globalState.get<string>(SKIP_VERSION_KEY);
  const updateAvailable = compareSemver(manifest.version, current) > 0 && manifest.version !== skipped;

  if (updateAvailable && !options.silent) {
    const choice = await vscode.window.showInformationMessage(
      `Hay una nueva versión de EditCore: ${manifest.version} (tienes ${current}).`,
      'Descargar',
      'Notas de versión',
      'Omitir esta versión'
    );
    if (choice === 'Descargar') {
      const url = manifest.setup?.url ?? manifest.portable?.url ?? RELEASES_URL;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } else if (choice === 'Notas de versión') {
      await vscode.env.openExternal(vscode.Uri.parse(RELEASES_URL));
    } else if (choice === 'Omitir esta versión') {
      await context.globalState.update(SKIP_VERSION_KEY, manifest.version);
    }
  }

  return { updateAvailable, current, latest: manifest.version, manifest };
}

export async function scheduleUpdateCheck(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('editcore');
  if (!config.get<boolean>('product.checkUpdatesOnStartup', true)) return;

  const last = context.globalState.get<string>(LAST_CHECK_KEY);
  if (last) {
    const hours = (Date.now() - new Date(last).getTime()) / 3_600_000;
    if (hours < 12) return;
  }

  setTimeout(() => {
    void checkForUpdates(context, { silent: true }).then((r) => {
      if (!r.updateAvailable || !r.latest) return;
      void vscode.window
        .showInformationMessage(
          `EditCore ${r.latest} disponible (tienes ${r.current}).`,
          'Descargar'
        )
        .then((c) => {
          if (c === 'Descargar') void vscode.env.openExternal(vscode.Uri.parse(RELEASES_URL));
        });
    });
  }, 4000);
}
