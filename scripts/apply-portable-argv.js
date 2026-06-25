/**
 * Desactiva workspace trust a nivel de arranque (evita Restricted Mode al abrir carpetas).
 */
const fs = require("fs");
const path = require("path");

const argvPath = path.join(process.env.APPDATA || "", "EditCore", "argv.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const argv = readJson(argvPath);
argv["disable-workspace-trust"] = true;

fs.mkdirSync(path.dirname(argvPath), { recursive: true });
fs.writeFileSync(argvPath, JSON.stringify(argv, null, 2) + "\n", "utf8");
console.log("OK: disable-workspace-trust ->", argvPath);
