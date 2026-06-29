export interface EditCoreClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface MeResponse {
  authenticated: boolean;
  scopes: string[];
}

/**
 * Cliente mínimo de la API pública de EditCore (docs/EDITCORE_API_PLATFORM.md).
 * Cubre únicamente los endpoints reales que existen hoy bajo /api/v1.
 */
export class EditCoreClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: EditCoreClientOptions) {
    if (!options.apiKey) {
      throw new Error("EditCoreClient requiere 'apiKey'.");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://editcore.mx";
  }

  async me(): Promise<MeResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/me`, {
      headers: { "x-editcore-api-key": this.apiKey },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `EditCore API error: ${res.status}`);
    }
    return (await res.json()) as MeResponse;
  }
}

export default EditCoreClient;
