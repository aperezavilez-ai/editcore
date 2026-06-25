import { httpJson } from "./httpClient";

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

const CF_API = "https://api.cloudflare.com/client/v4";

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function listCloudflareZones(token: string): Promise<CloudflareZone[]> {
  const res = await httpJson<{ result: CloudflareZone[] }>(`${CF_API}/zones`, {
    headers: headers(token),
  });
  return res.ok ? res.data?.result ?? [] : [];
}

export async function listDnsRecords(
  token: string,
  zoneId: string
): Promise<CloudflareDnsRecord[]> {
  const res = await httpJson<{ result: CloudflareDnsRecord[] }>(
    `${CF_API}/zones/${zoneId}/dns_records`,
    { headers: headers(token) }
  );
  return res.ok ? res.data?.result ?? [] : [];
}

export async function createDnsRecord(
  token: string,
  zoneId: string,
  type: string,
  name: string,
  content: string,
  proxied = true
): Promise<{ ok: boolean; message: string }> {
  const res = await httpJson(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: headers(token),
    body: { type, name, content, proxied },
  });
  return res.ok
    ? { ok: true, message: `DNS ${type} ${name} creado` }
    : { ok: false, message: res.error ?? "Error DNS" };
}
