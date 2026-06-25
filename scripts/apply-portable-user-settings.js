/**
 * Aplica branding/default-settings.json al perfil de usuario del portable EditCore.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultsPath = path.join(root, "branding", "default-settings.json");
const settingsPath = path.join(
  process.env.APPDATA || path.join(process.env.HOME || "", ".config"),
  "EditCore",
  "User",
  "settings.json"
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return raw ? JSON.parse(raw) : {};
}

const EDITCORE_FORCE_KEYS = [
  "workbench.startupEditor",
  "workbench.welcomePage.experimentalOnboarding",
  "chat.titleBar.signIn.enabled",
  "chat.agent.enabled",
  "chat.newSession.defaultMode",
  "chat.agentHost.enabled",
  "chat.agentsControl.enabled",
  "chat.unifiedAgentsBar.enabled",
  "chat.customizations.harnessSelector.enabled",
  "chat.extensionTools.enabled",
  "chat.generalPurposeAgent.enabled",
];

const defaults = readJson(defaultsPath);
const current = readJson(settingsPath);
const merged = { ...defaults, ...current };
for (const key of EDITCORE_FORCE_KEYS) {
  if (key in defaults) {
    merged[key] = defaults[key];
  }
}
delete merged["chat.defaultNewSessionMode"];

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log("OK: settings del usuario ->", settingsPath);
