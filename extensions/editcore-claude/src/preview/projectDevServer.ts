import * as fs from "fs";
import * as path from "path";

export interface DevServerInfo {
  command: string;
  port: number;
  framework?: "next" | "vite" | "other";
}

export function guessDevPort(root: string): number {
  const info = detectDevServerSync(root);
  return info?.port ?? 3000;
}

export function detectDevServerSync(root: string): DevServerInfo | undefined {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return undefined;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const isNext = Boolean(deps.next);
    const isVite = Boolean(deps.vite);

    const devScript = pkg.scripts?.dev;
    if (devScript) {
      return {
        command: "npm run dev",
        port: extractPortFromScript(devScript) ?? (isVite ? 5173 : 3000),
        framework: isNext ? "next" : isVite ? "vite" : "other",
      };
    }

    const startScript = pkg.scripts?.start;
    if (startScript && (isNext || /next\s+start/.test(startScript))) {
      return {
        command: "npm run start",
        port: extractPortFromScript(startScript) ?? 3000,
        framework: "next",
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function candidateDevPorts(dev: DevServerInfo): number[] {
  const ports = new Set<number>([dev.port]);
  if (dev.framework === "next" || dev.port === 3000) {
    for (let port = 3000; port <= 3010; port++) {
      ports.add(port);
    }
  }
  if (dev.framework === "vite" || dev.port === 5173) {
    for (let port = 5173; port <= 5180; port++) {
      ports.add(port);
    }
  }
  return [...ports];
}

function extractPortFromScript(script: string): number | undefined {
  const explicit = script.match(/(?:--port|-p)\s+(\d{2,5})/);
  if (explicit) {
    return Number(explicit[1]);
  }
  const inline = script.match(/:(\d{2,5})/);
  if (inline) {
    return Number(inline[1]);
  }
  return undefined;
}
