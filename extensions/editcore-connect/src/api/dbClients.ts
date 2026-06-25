import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export type DbKind = "postgresql" | "mysql" | "sqlite" | "mongodb" | "redis";

export interface DbConnectionInfo {
  kind: DbKind;
  url?: string;
  host?: string;
  reachable: boolean;
  message: string;
}

function parseDatabaseUrl(envPath: string): string | undefined {
  if (!fs.existsSync(envPath)) return undefined;
  const content = fs.readFileSync(envPath, "utf8");
  const m = content.match(/DATABASE_URL=(.+)/) ?? content.match(/REDIS_URL=(.+)/);
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export async function detectDatabaseFromWorkspace(root: string): Promise<DbConnectionInfo[]> {
  const results: DbConnectionInfo[] = [];
  const envUrl = parseDatabaseUrl(path.join(root, ".env")) ?? parseDatabaseUrl(path.join(root, ".env.local"));

  if (envUrl) {
    if (envUrl.startsWith("postgres")) {
      results.push(await pingPostgres(envUrl));
    } else if (envUrl.startsWith("mysql")) {
      results.push(await pingMysql(envUrl));
    } else if (envUrl.startsWith("mongodb")) {
      results.push({ kind: "mongodb", url: maskUrl(envUrl), reachable: false, message: "MongoDB: verificar con mongosh" });
    } else if (envUrl.startsWith("redis")) {
      results.push(await pingRedis(envUrl));
    }
  }

  const sqliteCandidates = ["dev.db", "data.db", "database.sqlite"];
  for (const f of sqliteCandidates) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) {
      results.push({ kind: "sqlite", reachable: true, message: `SQLite local: ${f}` });
    }
  }

  return results;
}

function maskUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

async function pingPostgres(url: string): Promise<DbConnectionInfo> {
  try {
    await execAsync(`psql "${url}" -c "SELECT 1"`, {
      timeout: 10_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return { kind: "postgresql", url: maskUrl(url), reachable: true, message: "PostgreSQL OK" };
  } catch (err) {
    return {
      kind: "postgresql",
      url: maskUrl(url),
      reachable: false,
      message: err instanceof Error ? err.message : "PostgreSQL no alcanzable",
    };
  }
}

async function pingMysql(url: string): Promise<DbConnectionInfo> {
  return {
    kind: "mysql",
    url: maskUrl(url),
    reachable: false,
    message: "MySQL detectado — instalar cliente mysql para ping",
  };
}

async function pingRedis(url: string): Promise<DbConnectionInfo> {
  try {
    const host = url.replace("redis://", "").split(":")[0];
    await execAsync(process.platform === "win32" ? `ping -n 1 ${host}` : `ping -c 1 ${host}`, {
      timeout: 10_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return { kind: "redis", url: maskUrl(url), reachable: true, message: `Redis host ${host} responde ping` };
  } catch {
    return { kind: "redis", url: maskUrl(url), reachable: false, message: "Redis no alcanzable" };
  }
}
