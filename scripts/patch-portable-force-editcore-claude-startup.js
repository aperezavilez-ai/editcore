/**
 * Fuerza habilitación y activación temprana de editcore.editcore-claude.
 * Cierra EditCore antes de ejecutar.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: force editcore-claude startup";
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
  console.log("OK: parche activación editcore-claude ya aplicado");
  process.exit(0);
}

const replacements = [
  {
    from: `    if (this._chatExtensionId === "editcore.editcore-claude") {
      return;
    }`,
    to: `    if (this._chatExtensionId === "editcore.editcore-claude") {
      if (this._isDisabledGlobally({ id: this._chatExtensionId })) {
        this._enableExtension({ id: this._chatExtensionId });
      }
      return; /* ${MARKER} */
    }`,
  },
  {
    from: `    extensionService.whenInstalledExtensionsRegistered().then(() => {
      if (!this._store.isDisposed) {
        this._extensionsRegistered = true;
        this._update();
      }
    });`,
    to: `    extensionService.whenInstalledExtensionsRegistered().then(() => {
      if (!this._store.isDisposed) {
        this._extensionsRegistered = true;
        this._update();
      }
      const editCoreChatId = new ExtensionIdentifier("editcore.editcore-claude");
      extensionService.activateById(editCoreChatId, { activationEvent: "onStartupFinished", extensionId: editCoreChatId, startup: true }).catch(() => {
      }); /* ${MARKER} */
    });`,
  },
];

let applied = 0;
for (const { from, to } of replacements) {
  if (!src.includes(from)) {
    console.warn("WARN: bloque no encontrado:", from.slice(0, 70).replace(/\n/g, " "));
    continue;
  }
  src = src.replace(from, to);
  applied++;
}

if (applied === 0) {
  console.error("ERROR: no se aplicó ningún parche de activación");
  process.exit(1);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parches activación editcore-claude ->`, workbenchPath);
