/**
 * EditCore: el browser NO debe aparecer como chip en el chat ni cerrarse al quitarlo.
 * - No inyectar pestaña Browser en contexto implícito del chat.
 * - No forzar "compartir con agente" al adjuntar browser.
 * - Al quitar adjunto browser del chat, no descompartir/cerrar la pestaña.
 */
const fs = require("fs");
const path = require("path");

const MARKER_IMPLICIT = "EditCore: no browser implicit context in chat";
const MARKER_RESOLVE = "EditCore: no auto-share browser on chat attach";
const MARKER_DELETE = "EditCore: detach browser from chat without closing tab";

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

function patchOnce({ marker, from, to, label }) {
  if (src.includes(marker)) {
    return;
  }
  if (!src.includes(from)) {
    console.warn(`WARN: bloque no encontrado (${label})`);
    return;
  }
  src = src.replace(from, to);
  applied++;
}

patchOnce({
  marker: MARKER_IMPLICIT,
  label: "skip browser implicit context",
  from: `    const browser = this.findActiveBrowserEditor();
    if (browser?.isSharingAvailable && useSuggestedContext) {
      newValue = browser.resource;
    }`,
  to: `    /* ${MARKER_IMPLICIT} */
    if (product_default.applicationName !== "editcore") {
      const browser = this.findActiveBrowserEditor();
      if (browser?.isSharingAvailable && useSuggestedContext) {
        newValue = browser.resource;
      }
    }`,
});

patchOnce({
  marker: MARKER_RESOLVE,
  label: "skip auto-share on browser attach",
  from: `    if (model.sharingState === "notShared" /* NotShared */) {
      if (!await model.setSharedWithAgent(true)) {
        return void 0;
      }
    }
    return {
      kind: "browserView",
      id: editor.resource.toString(),
      name: editor.getName(),
      value: editor.resource,
      browserId: editor.id,
      modelDescription: \`Browser page: \${editor.getTitle()}. The pageId is "\${editor.id}".\`
    };`,
  to: `    if (product_default.applicationName !== "editcore" && model.sharingState === "notShared" /* NotShared */) {
      if (!await model.setSharedWithAgent(true)) {
        return void 0;
      }
    } /* ${MARKER_RESOLVE} */
    return {
      kind: "browserView",
      id: editor.resource.toString(),
      name: editor.getName(),
      value: editor.resource,
      browserId: editor.id,
      modelDescription: \`Browser page: \${editor.getTitle()}. The pageId is "\${editor.id}".\`
    };`,
});

patchOnce({
  marker: MARKER_DELETE,
  label: "browser attachment delete without unshare",
  from: `  handleAttachmentDeletion(e, index2, attachment) {
    if (isKeyboardEvent(e)) {
      this._indexOfLastAttachedContextDeletedWithKeyboard = index2;
    }
    this._attachmentModel.delete(attachment.id);`,
  to: `  handleAttachmentDeletion(e, index2, attachment) {
    if (isKeyboardEvent(e)) {
      this._indexOfLastAttachedContextDeletedWithKeyboard = index2;
    }
    if (product_default.applicationName === "editcore" && isBrowserViewVariableEntry(attachment)) { /* ${MARKER_DELETE} */
      this._attachmentModel.delete(attachment.id);
      if (this._attachmentModel.size === 0) {
        this.focus();
      }
      this._onDidChangeContext.fire({ removed: [attachment] });
      this.renderAttachedContext();
      return;
    }
    this._attachmentModel.delete(attachment.id);`,
});

patchOnce({
  marker: "EditCore: no convert browser implicit to attachment",
  label: "convertToRegularAttachment skip browser",
  from: `  async convertToRegularAttachment(attachment) {
    if (!attachment.value) {
      return;
    }
    if (isStringImplicitContextValue(attachment.value)) {`,
  to: `  async convertToRegularAttachment(attachment) {
    if (!attachment.value) {
      return;
    }
    if (product_default.applicationName === "editcore") {
      const browserUri = URI.isUri(attachment.value)
        ? attachment.value
        : isLocation(attachment.value)
          ? attachment.value.uri
          : void 0;
      if (browserUri?.scheme === Schemas.vscodeBrowser) {
        attachment.enabled = false;
        return;
      }
    }
    if (isStringImplicitContextValue(attachment.value)) {`,
});

if (applied === 0) {
  const markers = [MARKER_IMPLICIT, MARKER_RESOLVE, MARKER_DELETE, "EditCore: no convert browser implicit to attachment"];
  if (markers.every((m) => src.includes(m))) {
    console.log("OK: parche chat/browser context ya aplicado");
  } else {
    console.warn("WARN: faltan parches chat/browser context");
  }
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) chat/browser context ->`, workbenchPath);
