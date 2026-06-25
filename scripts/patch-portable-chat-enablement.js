const fs = require("fs");
const p =
  "D:/EDITCORE/VSCode-win32-x64/resources/app/out/vs/workbench/workbench.desktop.main.js";
let s = fs.readFileSync(p, "utf8");
const marker = 'if (this._chatExtensionId === "editcore.editcore-claude")';
if (s.includes(marker)) {
  console.log("Ya parcheado.");
  process.exit(0);
}
const needle =
  "ensureChatExtensionInitialDisabledState() {\n    if (!this._chatExtensionId || this.environmentService.isSessionsWindow || this.environmentService.skipBuiltinExtensions?.some((id2) => id2.toLowerCase() === this._chatExtensionId)) {\n      return;\n    }\n    const builtinChatExtensionEnablementMigrationKey";
const insert =
  'ensureChatExtensionInitialDisabledState() {\n    if (!this._chatExtensionId || this.environmentService.isSessionsWindow || this.environmentService.skipBuiltinExtensions?.some((id2) => id2.toLowerCase() === this._chatExtensionId)) {\n      return;\n    }\n    if (this._chatExtensionId === "editcore.editcore-claude") {\n      return;\n    }\n    const builtinChatExtensionEnablementMigrationKey';
if (!s.includes(needle)) {
  console.error("No se encontró el bloque a parchear en workbench.desktop.main.js");
  process.exit(1);
}
fs.writeFileSync(p, s.replace(needle, insert));
console.log("OK: workbench parcheado (no deshabilitar editcore-claude).");
