import * as vscode from 'vscode';

const SECRET_ACCESS_TOKEN = 'editcore.userAccessToken';
const SECRET_REFRESH_TOKEN = 'editcore.userRefreshToken';
const SETTING_BACKEND_URL = 'editcore.orgBackendUrl';
const DEFAULT_BACKEND_URL = 'https://editcore.mx';

const SUPABASE_URL = 'https://xhoxplbeggvtxdujcxqn.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhob3hwbGJlZ2d2dHhkdWpjeHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTMwMTIsImV4cCI6MjA5ODMyOTAxMn0.ULRc-ihr1nq8A0RoorN-kUiBJ9RJnF7rNlRj7xkg49k';

function getBackendUrl(): string {
  return vscode.workspace.getConfiguration().get<string>(SETTING_BACKEND_URL, DEFAULT_BACKEND_URL);
}

export interface AccountInfo {
  user: { id: string; email?: string };
  profile: { organization_id: string | null; full_name: string | null; role: string } | null;
  organization: { id: string; name: string; plan: string } | null;
}

export class UserAccountAuthService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getAccessToken(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_ACCESS_TOKEN);
  }

  async isLoggedIn(): Promise<boolean> {
    return !!(await this.getAccessToken());
  }

  async logout(): Promise<void> {
    await this.context.secrets.delete(SECRET_ACCESS_TOKEN);
    await this.context.secrets.delete(SECRET_REFRESH_TOKEN);
  }

  async promptLogin(): Promise<void> {
    const email = await vscode.window.showInputBox({
      title: 'EditCore: iniciar sesión',
      prompt: 'Correo de tu cuenta EditCore (la misma que usaste para registrarte en editcore.mx)',
      ignoreFocusOut: true,
    });
    if (!email?.trim()) return;

    const password = await vscode.window.showInputBox({
      title: 'EditCore: iniciar sesión',
      prompt: 'Contraseña',
      password: true,
      ignoreFocusOut: true,
    });
    if (!password) return;

    const ok = await this.login(email.trim(), password);
    if (!ok) {
      vscode.window.showErrorMessage('EditCore: correo o contraseña incorrectos.');
      return;
    }

    const info = await this.fetchAccountInfo();
    if (!info) {
      vscode.window.showWarningMessage('EditCore: sesión iniciada, pero no se pudo cargar la cuenta.');
      return;
    }
    if (info.organization) {
      vscode.window.showInformationMessage(
        `EditCore: sesión iniciada como ${info.user.email} · organización "${info.organization.name}" · plan ${info.organization.plan}.`
      );
    } else {
      vscode.window.showInformationMessage(
        `EditCore: sesión iniciada como ${info.user.email}. Tu cuenta todavía no tiene una organización asignada.`
      );
    }
  }

  private async login(email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!data.access_token) return false;
      await this.context.secrets.store(SECRET_ACCESS_TOKEN, data.access_token);
      if (data.refresh_token) {
        await this.context.secrets.store(SECRET_REFRESH_TOKEN, data.refresh_token);
      }
      return true;
    } catch {
      return false;
    }
  }

  async fetchAccountInfo(): Promise<AccountInfo | undefined> {
    const token = await this.getAccessToken();
    if (!token) return undefined;
    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return undefined;
      return (await res.json()) as AccountInfo;
    } catch {
      return undefined;
    }
  }

  async showAccount(): Promise<void> {
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      const choice = await vscode.window.showInformationMessage(
        'EditCore: no has iniciado sesión con tu cuenta.',
        'Iniciar sesión'
      );
      if (choice === 'Iniciar sesión') {
        await this.promptLogin();
      }
      return;
    }
    const info = await this.fetchAccountInfo();
    if (!info) {
      vscode.window.showWarningMessage('EditCore: tu sesión expiró o no se pudo validar. Inicia sesión de nuevo.');
      await this.logout();
      return;
    }
    vscode.window.showInformationMessage(
      `${info.user.email} · organización: ${info.organization?.name ?? 'sin asignar'} · plan: ${
        info.organization?.plan ?? '—'
      } · rol: ${info.profile?.role ?? '—'}`
    );
  }
}
