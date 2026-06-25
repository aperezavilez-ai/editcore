#!/usr/bin/env node
/**
 * Ajusta solo extensionId/chatExtensionId en defaultChatAgent.
 * NO reemplaza el objeto completo (Code-OSS lo requiere intacto para arrancar).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const productPath = path.join(root, "VSCode-win32-x64", "resources", "app", "product.json");
const upstreamPath = path.join(root, "editcore-src", "product.json");
const brandingPath = path.join(root, "branding", "product.json");

const CHAT_EXTENSION_ID = "editcore.editcore-claude";
const CONNECT_EXTENSION_ID = "editcore.editcore-connect";

if (!fs.existsSync(productPath)) {
  console.warn("skip: no existe", productPath);
  process.exit(0);
}

const product = JSON.parse(fs.readFileSync(productPath, "utf8").replace(/^\uFEFF/, ""));

// Si defaultChatAgent fue truncado, restaurar desde editcore-src.
const agent = product.defaultChatAgent ?? {};
const looksTruncated =
  !agent.chatExtensionOutputId ||
  !agent.providerExtensionId ||
  !agent.entitlementUrl;

if (looksTruncated && fs.existsSync(upstreamPath)) {
  const upstream = JSON.parse(fs.readFileSync(upstreamPath, "utf8").replace(/^\uFEFF/, ""));
  if (upstream.defaultChatAgent) {
    product.defaultChatAgent = { ...upstream.defaultChatAgent };
    console.log("OK: defaultChatAgent restaurado desde editcore-src");
  }
}

if (!product.defaultChatAgent || typeof product.defaultChatAgent !== "object") {
  console.error("ERROR: defaultChatAgent ausente en product.json");
  process.exit(1);
}

product.defaultChatAgent.extensionId = CHAT_EXTENSION_ID;
product.defaultChatAgent.chatExtensionId = CHAT_EXTENSION_ID;

product.builtInExtensionsEnabledWithAutoUpdates = [CHAT_EXTENSION_ID];

if (!product.extensionUntrustedWorkspaceSupport) {
  product.extensionUntrustedWorkspaceSupport = {};
}
product.extensionUntrustedWorkspaceSupport[CHAT_EXTENSION_ID] = {
  override: true,
};
product.extensionUntrustedWorkspaceSupport[CONNECT_EXTENSION_ID] = {
  override: true,
};

if (fs.existsSync(brandingPath)) {
  const branding = JSON.parse(fs.readFileSync(brandingPath, "utf8").replace(/^\uFEFF/, ""));
  if (branding.extensionEnabledApiProposals?.[CHAT_EXTENSION_ID]) {
    if (!product.extensionEnabledApiProposals) {
      product.extensionEnabledApiProposals = {};
    }
    product.extensionEnabledApiProposals[CHAT_EXTENSION_ID] =
      branding.extensionEnabledApiProposals[CHAT_EXTENSION_ID];
    console.log("OK: API proposals sincronizadas desde branding/product.json");
  }
}

fs.writeFileSync(productPath, JSON.stringify(product, null, "\t") + "\n", "utf8");
console.log("OK: chat apunta a", CHAT_EXTENSION_ID, "->", productPath);
