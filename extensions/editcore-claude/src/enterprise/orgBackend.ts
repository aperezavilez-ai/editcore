import * as vscode from 'vscode';

const SECRET_ORG_KEY = 'editcore.orgApiKey';
const SETTING_BACKEND_URL = 'editcore.orgBackendUrl';
const DEFAULT_BACKEND_URL = 'https://editcore.mx';

export interface OrgPlanResponse {
  organization: { id: string; name: string; plan: string; created_at: string };
  subscription: Record<string, unknown> | null;
}

export interface UsageSummaryResponse {
  plan: string;
  monthlyTokenLimit: number;
  includedSeats: number;
  tokensUsedThisMonth: number;
  estimatedCostUsdThisMonth: number;
  overLimit: boolean;
}

export interface TrackUsagePayload {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  toolName?: string;
  projectLabel?: string;
}

function getBackendUrl(): string {
  return vscode.workspace.getConfiguration().get<string>(SETTING_BACKEND_URL, DEFAULT_BACKEND_URL);
}

export class OrgBackendService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getOrgApiKey(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_ORG_KEY);
  }

  async setOrgApiKey(key: string): Promise<void> {
    await this.context.secrets.store(SECRET_ORG_KEY, key.trim());
  }

  async clearOrgApiKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_ORG_KEY);
  }

  async promptForOrgApiKey(): Promise<void> {
    const key = await vscode.window.showInputBox({
      title: 'EditCore: clave de organización',
      prompt: 'Pega la clave de organización (la que te dio tu administrador de EditCore).',
      password: true,
      ignoreFocusOut: true,
    });
    if (!key?.trim()) {
      return;
    }
    await this.setOrgApiKey(key);
    const result = await this.fetchPlan();
    if (result) {
      vscode.window.showInformationMessage(
        `EditCore: conectado a la organización "${result.organization.name}" (plan ${result.organization.plan}).`
      );
    } else {
      vscode.window.showWarningMessage('EditCore: la clave no pudo validarse contra el backend.');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const key = await this.getOrgApiKey();
    if (!key) {
      return undefined;
    }
    try {
      const res = await fetch(`${getBackendUrl()}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-editcore-org-key': key,
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        return undefined;
      }
      return (await res.json()) as T;
    } catch {
      return undefined;
    }
  }

  async fetchPlan(): Promise<OrgPlanResponse | undefined> {
    return this.request<OrgPlanResponse>('/api/org/plan');
  }

  async fetchUsageSummary(): Promise<UsageSummaryResponse | undefined> {
    return this.request<UsageSummaryResponse>('/api/usage/summary');
  }

  async trackUsage(payload: TrackUsagePayload): Promise<void> {
    const key = await this.getOrgApiKey();
    if (!key) {
      return;
    }
    await this.request('/api/usage/track', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
