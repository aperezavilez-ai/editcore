/**
 * EditCore: al registrar el LM provider de una extensión, resolver modelos de inmediato.
 * Sin esto, _modelCache queda vacío (antes GPTPRO4ALL lo llenaba en builtin init).
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: resolve LM on provider register";
const workbenchPath = path.join(
  __dirname,
  "..",
  "VSCode-win32-x64",
  "resources",
  "app",
  "out",
  "vs",
  "workbench",
  "workbench.desktop.main.js"
);

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");

if (src.includes(MARKER)) {
  console.log("OK: parche LM resolve on register ya aplicado");
  process.exit(0);
}

const from = `    this._providers.set(vendor, provider);
    const modelChangeListener = provider.onDidChange(() => {
      this._resolveAllLanguageModels(vendor, true);
    });`;

const to = `    this._providers.set(vendor, provider);
    void this._resolveAllLanguageModels(vendor, true); /* ${MARKER} */
    const modelChangeListener = provider.onDidChange(() => {
      this._resolveAllLanguageModels(vendor, true);
    });`;

if (!src.includes(from)) {
  console.warn("WARN: bloque registerLanguageModelProvider no encontrado");
  process.exit(0);
}

src = src.replace(from, to);
fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: LM resolve on register ->", workbenchPath);
