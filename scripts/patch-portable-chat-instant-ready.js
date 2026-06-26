/**
 * EditCore: activa editcore-claude antes de esperar y evita timeout Copilot/GitHub.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: instant chat ready";
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
  console.log("OK: parche instant chat ready ya aplicado");
  process.exit(0);
}

const from = `  async doForwardRequestToChatWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
    const authExtensionReEnabled = await maybeEnableAuthExtension(this.extensionsWorkbenchService, this.logService);
    if (authExtensionReEnabled) {
      refreshTokens(this.commandService);
    }
    const widget = chatWidgetService.getWidgetBySessionResource(requestModel.session.sessionResource);`;

const to = `  async doForwardRequestToChatWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
    const authExtensionReEnabled = await maybeEnableAuthExtension(this.extensionsWorkbenchService, this.logService);
    if (authExtensionReEnabled) {
      refreshTokens(this.commandService);
    }
    if (defaultChat5.chatExtensionId === "editcore.editcore-claude") {
      await this.instantiationService.invokeFunction(async (accessor) => {
        const extensionService = accessor.get(IExtensionService);
        const id = new ExtensionIdentifier("editcore.editcore-claude");
        try {
          await extensionService.activateById(id, { startup: true, extensionId: id, activationEvent: "onStartupFinished" });
        } catch {
        }
      });
      for (let i = 0; i < 48; i++) {
        const hasModels = languageModelsService.getLanguageModelIds().some((mid) => mid.startsWith("editcore/"));
        const agent = chatAgentService.getAgent("editcore.claude");
        if (hasModels && agent) {
          break;
        }
        await timeout(250);
      }
      const widgetEarly = chatWidgetService.getWidgetBySessionResource(requestModel.session.sessionResource);
      const modeEarly = widgetEarly?.input.currentModeInfo;
      const hasModelsNow = languageModelsService.getLanguageModelIds().some((mid) => mid.startsWith("editcore/"));
      if (hasModelsNow && chatAgentService.getAgent("editcore.claude")) {
        markChatGlobal(ChatGlobalPerfMark.DidWaitForActivation);
        await chatService.resendRequest(requestModel, {
          ...widgetEarly?.getModeRequestOptions(),
          modeInfo: modeEarly,
          userSelectedModelId: widgetEarly?.input?.currentLanguageModel
        });
        return;
      }
    } /* ${MARKER} */
    const widget = chatWidgetService.getWidgetBySessionResource(requestModel.session.sessionResource);`;

if (!src.includes(from)) {
  console.error("ERROR: bloque doForwardRequestToChatWhenReady no encontrado");
  process.exit(1);
}
src = src.replace(from, to);

const timeoutFrom = `          } else {
            warningMessage = localize(8912, null, defaultChat5.provider.default.name, defaultChat5.chatExtensionId);
          }`;
const timeoutTo = `          } else if (defaultChat5.chatExtensionId === "editcore.editcore-claude") {
            warningMessage = "EditCore no pudo iniciar el chat. Configura tu API Key (Ctrl+Alt+K), recarga con Ctrl+Alt+R o ejecuta EditCore: Reparar chat.";
          } else {
            warningMessage = localize(8912, null, defaultChat5.provider.default.name, defaultChat5.chatExtensionId);
          }`;

if (src.includes(timeoutFrom)) {
  src = src.replace(timeoutFrom, timeoutTo);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: parche instant chat ready ->", workbenchPath);
