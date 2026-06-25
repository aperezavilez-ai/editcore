/**
 * Chat limpio: sin avatar/nombre en respuestas, sin footer (copy/thumbs/retry).
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: chat limpio sin header ni footer";
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
let applied = 0;

if (!src.includes(MARKER)) {
  const fromPanel = `        rendererOptions: {
          renderTextEditsAsSummary: (uri5) => {
            return true;
          },
          referencesExpandedWhenEmptyResponse: false,
          progressMessageAtBottomOfResponse: (mode) => mode !== "ask" /* Ask */
        },`;
  const toPanel = `        rendererOptions: {
          renderTextEditsAsSummary: (uri5) => {
            return true;
          },
          referencesExpandedWhenEmptyResponse: false,
          progressMessageAtBottomOfResponse: (mode) => mode !== "ask" /* Ask */,
          noHeader: true,
          noFooter: true /* ${MARKER} */
        },`;
  if (src.includes(fromPanel)) {
    src = src.replace(fromPanel, toPanel);
    applied++;
  } else {
    console.warn("WARN: bloque ChatWidget panel no encontrado");
  }
}

const identityMarker = "EditCore: ocultar identidad en respuestas de chat";
if (!src.includes(identityMarker)) {
  const fromIdentity = `function shouldHideChatUserIdentity(username, sessionResource, isResponse, isSessionsWindow, isSystemInitiatedRequest) {
  const sessionType = getChatSessionType(sessionResource);
  return username === COPILOT_USERNAME || isResponse && isAgentHostCopilotSessionType(sessionType) || isSessionsWindow || isSystemInitiatedRequest;
}`;
  const toIdentity = `function shouldHideChatUserIdentity(username, sessionResource, isResponse, isSessionsWindow, isSystemInitiatedRequest) {
  const sessionType = getChatSessionType(sessionResource);
  if (isResponse) {
    return true; /* ${identityMarker} */
  }
  return username === COPILOT_USERNAME || isAgentHostCopilotSessionType(sessionType) || isSessionsWindow || isSystemInitiatedRequest;
}`;
  if (src.includes(fromIdentity)) {
    src = src.replace(fromIdentity, toIdentity);
    applied++;
  } else {
    console.warn("WARN: shouldHideChatUserIdentity no encontrado");
  }
}

if (applied === 0) {
  console.log("OK: parche chat limpio ya aplicado");
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) chat limpio ->`, workbenchPath);
