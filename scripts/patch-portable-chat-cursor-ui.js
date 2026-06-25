/**
 * Chat estilo Cursor: sin @agent en burbujas, sin nombres en mensajes, preview de imágenes pegadas.
 * No toca modelos ni agente — solo UI del workbench.
 */
const fs = require("fs");
const path = require("path");

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

const MARKER_AGENT = "EditCore: sin @agent en burbuja usuario";
const MARKER_USER_ID = "EditCore: ocultar identidad mensajes usuario";
const MARKER_IMAGE = "EditCore: preview imagen pegada en chat";
const MARKER_WEBP = "EditCore: webp paste chat";
const MARKER_PANEL_ONLY = "EditCore: chat solo en panel lateral";
const MARKER_NEWCHAT_PANEL = "EditCore: newChat usa panel lateral";

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");
let applied = 0;

if (!src.includes(MARKER_AGENT)) {
  const fromAgent = `      } else if (part instanceof ChatRequestAgentPart) {
        result += this.instantiationService.invokeFunction((accessor) => agentToMarkdown(part.agent, sessionResource, false, accessor));
      } else {`;
  const toAgent = `      } else if (part instanceof ChatRequestAgentPart) {
        /* ${MARKER_AGENT} */
      } else {`;
  if (src.includes(fromAgent)) {
    src = src.replace(fromAgent, toAgent);
    applied++;
  } else {
    console.warn("WARN: ChatRequestAgentPart en convertParsedRequestToMarkdown no encontrado");
  }
}

if (!src.includes(MARKER_USER_ID)) {
  const fromUserId = `  if (isResponse) {
    return true; /* EditCore: ocultar identidad en respuestas de chat */
  }
  return username === COPILOT_USERNAME || isAgentHostCopilotSessionType(sessionType) || isSessionsWindow || isSystemInitiatedRequest;`;
  const toUserId = `  if (isResponse) {
    return true; /* EditCore: ocultar identidad en respuestas de chat */
  }
  if (!isSessionsWindow) {
    return true; /* ${MARKER_USER_ID} */
  }
  return username === COPILOT_USERNAME || isAgentHostCopilotSessionType(sessionType) || isSystemInitiatedRequest;`;
  if (src.includes(fromUserId)) {
    src = src.replace(fromUserId, toUserId);
    applied++;
  } else {
    console.warn("WARN: shouldHideChatUserIdentity (usuario) no encontrado");
  }
}

if (!src.includes(MARKER_WEBP)) {
  const fromWebp = `    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/gif",
      "image/tiff"
    ];`;
  const toWebp = `    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/gif",
      "image/tiff",
      "image/webp" /* ${MARKER_WEBP} */
    ];`;
  if (src.includes(fromWebp)) {
    src = src.replace(fromWebp, toWebp);
    applied++;
  } else {
    console.warn("WARN: supportedMimeTypes paste imagen no encontrado");
  }
}

if (!src.includes(MARKER_IMAGE)) {
  const fromImage = `  const pillIcon = $("div.chat-attached-context-pill", {}, $(supportsVision && !previewFeaturesDisabled ? "span.codicon.codicon-file-media" : "span.codicon.codicon-warning"));
  const textLabel = $("span.chat-attached-context-custom-text", {}, name);
  element.appendChild(pillIcon);
  element.appendChild(textLabel);`;
  const toImage = `  const pillIcon = $("div.chat-attached-context-pill", {}, $(supportsVision && !previewFeaturesDisabled ? "span.codicon.codicon-file-media" : "span.codicon.codicon-warning"));
  const textLabel = $("span.chat-attached-context-custom-text", {}, name);
  const imageBytes = buffer ? buffer instanceof Uint8Array ? buffer.byteLength : buffer.length : 0;
  element.appendChild(pillIcon);
  if (!imageBytes) {
    element.appendChild(textLabel);
  } /* ${MARKER_IMAGE} */`;

  const fromThumb = `      if (thumbnail) {
        const pillImg = $("img.chat-attached-context-pill-image", { src: url, alt: "" });
        const pill = $("div.chat-attached-context-pill", {}, pillImg);
        replacePill(pill);
      }
      hoverImage.onerror = onImageFailed;
      hoverImage.src = url;`;

  const toThumb = `      {
        const pillImg = $("img.chat-attached-context-pill-image", { src: url, alt: "" });
        const pill = $("div.chat-attached-context-pill", {}, pillImg);
        replacePill(pill);
      } /* ${MARKER_IMAGE} */
      hoverImage.onerror = onImageFailed;
      hoverImage.src = url;`;

  if (src.includes(fromImage) && src.includes(fromThumb)) {
    src = src.replace(fromImage, toImage).replace(fromThumb, toThumb);
    applied++;
  } else {
    console.warn("WARN: createImageElements no encontrado");
  }
}

if (!src.includes(MARKER_PANEL_ONLY)) {
  const fromReveal = `  async revealWidget(preserveFocus) {
    const last = this.lastFocusedWidget;
    if (last && await this.reveal(last, preserveFocus)) {
      return last;
    }
    return (await this.viewsService.openView(ChatViewId, !preserveFocus))?.widget;
  }`;
  const toReveal = `  async revealWidget(preserveFocus) {
    const last = this.lastFocusedWidget;
    if (last && isIChatViewViewContext(last.viewContext) && await this.reveal(last, preserveFocus)) {
      return last;
    } /* ${MARKER_PANEL_ONLY} */
    return (await this.viewsService.openView(ChatViewId, !preserveFocus))?.widget;
  }`;
  if (src.includes(fromReveal)) {
    src = src.replace(fromReveal, toReveal);
    applied++;
  } else {
    console.warn("WARN: revealWidget no encontrado");
  }
}

if (!src.includes(MARKER_NEWCHAT_PANEL)) {
  const fromCtx = `  if (!chatWidget) {
    chatWidget = chatWidgetService.lastFocusedWidget ?? chatWidgetService.getWidgetsByLocations("panel" /* Chat */).find((w) => w.supportsChangingModes);
  }`;
  const toCtx = `  if (!chatWidget) {
    chatWidget = chatWidgetService.getWidgetsByLocations("panel" /* Chat */).find((w) => w.supportsChangingModes) ?? chatWidgetService.lastFocusedWidget; /* ${MARKER_NEWCHAT_PANEL} */
  }`;
  if (src.includes(fromCtx)) {
    src = src.replace(fromCtx, toCtx);
    applied++;
  } else {
    console.warn("WARN: getEditingSessionContext no encontrado");
  }
}

if (applied === 0) {
  if (
    src.includes(MARKER_AGENT) &&
    src.includes(MARKER_USER_ID) &&
    src.includes(MARKER_IMAGE) &&
    src.includes(MARKER_WEBP) &&
    src.includes(MARKER_PANEL_ONLY) &&
    src.includes(MARKER_NEWCHAT_PANEL)
  ) {
    console.log("OK: parche chat cursor-ui ya aplicado");
  } else {
    console.warn("WARN: faltan parches chat cursor-ui");
  }
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) chat cursor-ui ->`, workbenchPath);
