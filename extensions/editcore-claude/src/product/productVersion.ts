export const PRODUCT_NAME = 'EditCore IDE';

export const DOWNLOAD_PAGE_URL =
  'https://github.com/aperezavilez-ai/editcore/blob/main/docs/DOWNLOAD.md';

export const RELEASES_URL = 'https://github.com/aperezavilez-ai/editcore/releases';

export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/aperezavilez-ai/editcore/main/releases/latest.json';

export const SUPPORT_ISSUES_URL =
  'https://github.com/aperezavilez-ai/editcore/issues/new';

/** Versión empaquetada de la extensión (sincronizada con VERSION en build). */
export function getExtensionVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
