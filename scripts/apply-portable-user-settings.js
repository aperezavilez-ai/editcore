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
  "security.workspace.trust.enabled",
  "security.workspace.trust.startupPrompt",
  "security.workspace.trust.banner",
  "security.workspace.trust.untrustedFiles",
  "workbench.browser.showInTitleBar",
  "workbench.browser.openLocalhostLinks",
  "workbench.secondarySideBar.defaultVisibility",
  "workbench.welcomePage.experimentalOnboarding",
  "chat.titleBar.signIn.enabled",
  "chat.agent.enabled",
  "chat.newSession.defaultMode",
  "chat.agentHost.enabled",
  "chat.editor.localAgent.enabled",
  "chat.editor.copilotCli.hideExtensionHost",
  "chat.editor.defaultProvider",
  "chat.agentsControl.enabled",
  "chat.unifiedAgentsBar.enabled",
  "chat.customizations.harnessSelector.enabled",
  "chat.extensionTools.enabled",
  "chat.generalPurposeAgent.enabled",
  "chat.tips.enabled",
  "chat.implicitContext.suggestedContext",
  "imageCarousel.chat.enabled",
  "telemetry.feedback.enabled",
  "terminal.integrated.initialHint",
  "terminal.integrated.initialHintCopilotCli",
  "editcore.maxTokens",
  "editcore.fallback.enabled",
  "editcore.intelligence.enabled",
  "editcore.intelligence.autoAnalyze",
  "editcore.intelligence.skipMcpProbe",
  "editcore.intelligence.preferClaudeForAnalysis",
  "editcore.intelligence.permissionLevel",
  "editcore.autonomy.enabled",
  "editcore.autonomy.maxTasksPerRun",
  "editcore.autonomy.level",
  "editcore.agent.openAiForCoder",
  "editcore.evolution.gitBranchBeforeChanges",
  "editcore.evolution.continuousIntervalMinutes",
  "editcore.evolution.runValidation",
  "editcore.evolution.generateReportsAfterPipeline",
  "editcore.orchestrator.selfCritique",
  "editcore.multiAgent.enabled",
  "editcore.aos.enabled",
  "editcore.aos.modelOverride",
  "editcore.aos.security.enabled",
  "editcore.autonomous.enabled",
  "editcore.autonomous.mode",
  "editcore.autonomous.maxDebugCycles",
  "editcore.autonomous.useAosPipeline",
  "editcore.autonomous.autoCommit",
  "editcore.autonomous.autoApproveWrites",
  "editcore.autonomous.confirmCritical",
  "editcore.autonomous.useForAutonomyQueue",
  "editcore.autonomous.continuousEnabled",
  "editcore.knowledge.enabled",
  "editcore.knowledge.rag.enabled",
  "editcore.knowledge.useQdrantFallback",
  "editcore.knowledge.contextAssembler.enabled",
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
