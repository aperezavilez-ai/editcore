/**
 * Impide que el chat se abra en el editor central (pestaña encima de la terminal).
 */
const fs = require("fs");
const path = require("path");

const MARKER_OPEN = "EditCore: openSession solo panel";
const MARKER_NEW = "EditCore: newChatEditor redirige a panel";
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

if (!src.includes(MARKER_OPEN)) {
  const from = `    if (target === ChatViewPaneTarget || typeof target === "undefined") {
      const chatView = await this.viewsService.openView(ChatViewId, !options3?.preserveFocus);
      if (chatView) {
        await chatView.loadSession(sessionResource);
        if (!options3?.preserveFocus) {
          chatView.focusInput();
        }
      }
      this.logService.trace(\`[ChatWidgetService] openSession done total=\${Date.now() - t0}ms uri=\${sessionResource.toString()} path=view\`);
      return chatView?.widget;
    }
    const pane = await this.editorService.openEditor({`;

  const to = `    if (true) { /* ${MARKER_OPEN} */
      const chatView = await this.viewsService.openView(ChatViewId, !options3?.preserveFocus);
      if (chatView) {
        await chatView.loadSession(sessionResource);
        if (!options3?.preserveFocus) {
          chatView.focusInput();
        }
      }
      this.logService.trace(\`[ChatWidgetService] openSession done total=\${Date.now() - t0}ms uri=\${sessionResource.toString()} path=view\`);
      return chatView?.widget;
    }
    const pane = await this.editorService.openEditor({`;

  if (src.includes(from)) {
    src = src.replace(from, to);
    applied++;
  } else {
    console.warn("WARN: openSession panel branch no encontrado");
  }
}

if (!src.includes(MARKER_NEW)) {
  const fromRun = `    async run(accessor) {
      const widgetService = accessor.get(IChatWidgetService);
      await widgetService.openSession(getNewChatEditorSessionUri(accessor), ACTIVE_GROUP, { pinned: true });
    }`;
  const toRun = `    async run(accessor) {
      const commandService = accessor.get(ICommandService);
      await commandService.executeCommand(ACTION_ID_NEW_CHAT); /* ${MARKER_NEW} */
    }`;

  const count = (src.match(/await widgetService\.openSession\(getNewChatEditorSessionUri\(accessor\), ACTIVE_GROUP, \{ pinned: true \}\);/g) || []).length;
  if (count > 0) {
    src = src.split(fromRun).join(toRun);
    applied += count;
  }

  const sideFrom = `await widgetService.openSession(getNewChatEditorSessionUri(accessor), SIDE_GROUP, { pinned: true });`;
  const sideTo = `await accessor.get(ICommandService).executeCommand(ACTION_ID_NEW_CHAT); /* ${MARKER_NEW} */`;
  if (src.includes(sideFrom)) {
    src = src.replace(sideFrom, sideTo);
    applied++;
  }

  const auxFrom = `await widgetService.openSession(getNewChatEditorSessionUri(accessor), AUX_WINDOW_GROUP, { pinned: true, auxiliary: { compact: true, bounds: { width: 640, height: 640 } } });`;
  const auxTo = `await accessor.get(ICommandService).executeCommand(ACTION_ID_NEW_CHAT); /* ${MARKER_NEW} */`;
  if (src.includes(auxFrom)) {
    src = src.replace(auxFrom, auxTo);
    applied++;
  }

  if (count === 0 && !src.includes(sideFrom) && !src.includes(auxFrom)) {
    console.warn("WARN: NewChatEditorAction no encontrado");
  }
}

if (applied === 0) {
  if (src.includes(MARKER_OPEN) && src.includes(MARKER_NEW)) {
    console.log("OK: parche chat block-editor ya aplicado");
  } else {
    console.warn("WARN: faltan parches chat block-editor");
  }
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) chat block-editor ->`, workbenchPath);
