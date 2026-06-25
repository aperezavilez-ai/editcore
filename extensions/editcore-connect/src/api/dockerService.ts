import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync(process.platform === "win32" ? "where docker" : "which docker");
    const { stdout } = await execAsync("docker version --format {{.Server.Version}}", {
      timeout: 15_000,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

export async function listContainers(all = false): Promise<DockerContainer[]> {
  const flag = all ? "-a" : "";
  const { stdout } = await execAsync(`docker ps ${flag} --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"`, {
    timeout: 30_000,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, status] = line.split("|");
      return { id, name, image, status };
    });
}

export async function dockerComposeUp(cwd: string, detached = true): Promise<string> {
  const flag = detached ? " -d" : "";
  const { stdout, stderr } = await execAsync(`docker compose up${flag}`, {
    cwd,
    timeout: 300_000,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  return `${stdout}\n${stderr}`.trim();
}

export async function dockerComposeDown(cwd: string): Promise<string> {
  const { stdout, stderr } = await execAsync("docker compose down", {
    cwd,
    timeout: 120_000,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  return `${stdout}\n${stderr}`.trim();
}

export async function dockerBuild(cwd: string, tag: string): Promise<string> {
  const { stdout, stderr } = await execAsync(`docker build -t ${tag} .`, {
    cwd,
    timeout: 600_000,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
  return `${stdout}\n${stderr}`.trim().slice(-3000);
}
