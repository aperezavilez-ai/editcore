/**
 * Watermark central: Open Browser + Open Chat abre sesión nueva (editcore.focusChatInput).
 */
const fs = require("fs");
const path = require("path");

const MARKER_BROWSER = "EditCore: watermark Open Browser";
const MARKER_FRESH_CHAT = "EditCore: watermark fresh chat";
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
let changed = false;

if (src.includes(MARKER_BROWSER) && src.includes(MARKER_FRESH_CHAT)) {
  console.log("OK: parche watermark browser/fresh-chat ya aplicado");
  process.exit(0);
}

// Instalación limpia (sin browser aún).
const fromClean = `var openChat = { text: localize(5180, null), id: "workbench.action.chat.open", when: { native: showChatContextKey, web: showChatContextKey } };
var showCommands = { text: localize(5187, null), id: "workbench.action.showCommands" };`;

const toClean = `var openChat = { text: localize(5180, null), id: "editcore.focusChatInput", when: { native: showChatContextKey, web: showChatContextKey } }; /* ${MARKER_FRESH_CHAT} */
var openBrowser = { text: "Open Browser", id: "editcore.openBrowser" }; /* ${MARKER_BROWSER} */
var showCommands = { text: localize(5187, null), id: "workbench.action.showCommands" };`;

const fromBaseClean = `var baseEntries = [
  openChat,
  showCommands
];`;

const toBaseClean = `var baseEntries = [
  openChat,
  openBrowser,
  showCommands
];`;

if (src.includes(fromClean) && src.includes(fromBaseClean)) {
  src = src.replace(fromClean, toClean).replace(fromBaseClean, toBaseClean);
  changed = true;
} else if (src.includes(MARKER_BROWSER) && !src.includes(MARKER_FRESH_CHAT)) {
  const fromBrowserOnly = `var openChat = { text: localize(5180, null), id: "workbench.action.chat.open", when: { native: showChatContextKey, web: showChatContextKey } };
var openBrowser = { text: "Open Browser", id: "editcore.openBrowser" }; /* ${MARKER_BROWSER} */`;

  const toBrowserFresh = `var openChat = { text: localize(5180, null), id: "editcore.focusChatInput", when: { native: showChatContextKey, web: showChatContextKey } }; /* ${MARKER_FRESH_CHAT} */
var openBrowser = { text: "Open Browser", id: "editcore.openBrowser" }; /* ${MARKER_BROWSER} */`;

  if (src.includes(fromBrowserOnly)) {
    src = src.replace(fromBrowserOnly, toBrowserFresh);
    changed = true;
  }
}

if (!changed) {
  console.warn("WARN: bloque editorGroupWatermark no encontrado");
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: watermark Open Browser + fresh chat ->", workbenchPath);
