import * as vscode from 'vscode';

const LICENSE_SECRET = 'editcore.licenseKey';
const LICENSE_META = 'editcore.licenseMeta';

export type LicenseTier = 'community' | 'licensed' | 'trial';

export interface LicenseState {
  tier: LicenseTier;
  keyHint?: string;
  activatedAt?: string;
  label: string;
}

const KEY_PATTERN = /^EC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function hintKey(key: string): string {
  const parts = key.split('-');
  if (parts.length < 2) return 'EC-****';
  return `${parts[0]}-${parts[1]}-****-****`;
}

/** Validación local (sin servidor). Precios y facturación se añaden después. */
function validateKeyFormat(key: string): boolean {
  return KEY_PATTERN.test(key.trim().toUpperCase());
}

export async function getLicenseState(context: vscode.ExtensionContext): Promise<LicenseState> {
  const key = await context.secrets.get(LICENSE_SECRET);
  const meta = context.globalState.get<{ tier?: LicenseTier; activatedAt?: string }>(LICENSE_META);

  if (key && validateKeyFormat(key)) {
    return {
      tier: meta?.tier === 'trial' ? 'trial' : 'licensed',
      keyHint: hintKey(key),
      activatedAt: meta?.activatedAt,
      label: meta?.tier === 'trial' ? 'Prueba activada' : 'Licencia activa',
    };
  }

  return {
    tier: 'community',
    label: 'Edición comunidad (descarga gratuita)',
  };
}

export async function activateLicenseKey(
  context: vscode.ExtensionContext,
  rawKey: string
): Promise<{ ok: boolean; error?: string }> {
  const key = rawKey.trim().toUpperCase();
  if (!key) {
    return { ok: false, error: 'Introduce una clave de licencia.' };
  }
  if (!validateKeyFormat(key)) {
    return {
      ok: false,
      error: 'Formato inválido. Ejemplo: EC-AB12-CD34-EF56-GH78',
    };
  }

  await context.secrets.store(LICENSE_SECRET, key);
  await context.globalState.update(LICENSE_META, {
    tier: 'licensed' as LicenseTier,
    activatedAt: new Date().toISOString(),
  });

  return { ok: true };
}

export async function useCommunityEdition(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(LICENSE_SECRET);
  await context.globalState.update(LICENSE_META, {
    tier: 'community' as LicenseTier,
    activatedAt: new Date().toISOString(),
  });
}

export async function clearLicense(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(LICENSE_SECRET);
  await context.globalState.update(LICENSE_META, undefined);
}

/** Generador de claves de prueba para desarrollo (no usar en producción comercial). */
export function generateDevLicenseKey(): string {
  const block = () =>
    Math.random()
      .toString(36)
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 4)
      .toUpperCase()
      .padEnd(4, 'X');
  return `EC-${block()}-${block()}-${block()}-${block()}`;
}
