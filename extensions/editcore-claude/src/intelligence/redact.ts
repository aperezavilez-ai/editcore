const SECRET_KEY_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const SK_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g;

export function redactString(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(SK_PATTERN, "sk-***REDACTED***");
}

export function redactSecrets<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key) && typeof nested === "string") {
        result[key] = hintFromSecret(nested);
        continue;
      }
      result[key] = redactSecrets(nested);
    }
    return result as T;
  }
  return value;
}

function hintFromSecret(secret: string): string {
  const cleaned = secret.trim();
  if (!cleaned) {
    return "";
  }
  if (cleaned.length <= 12) {
    return "***";
  }
  return `${cleaned.slice(0, 7)}...${cleaned.slice(-4)}`;
}
