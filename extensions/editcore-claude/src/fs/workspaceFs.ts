import * as fs from "fs";

/** True si la ruta es un archivo de texto legible (no carpeta ni symlink a carpeta). */
export function isReadableFileSync(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function isReadableFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
