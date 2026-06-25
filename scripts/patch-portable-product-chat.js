#!/usr/bin/env node
/**
 * Limpia defaultChatAgent en el build portable: quita referencias a GitHub Copilot
 * y apunta el chat nativo solo a editcore-claude.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const productPath = path.join(root, "VSCode-win32-x64", "resources", "app", "product.json");

if (!fs.existsSync(productPath)) {
  console.warn("skip: no existe", productPath);
  process.exit(0);
}

const product = JSON.parse(fs.readFileSync(productPath, "utf8").replace(/^\uFEFF/, ""));
product.defaultChatAgent = {
  extensionId: "editcore.editcore-claude",
  chatExtensionId: "editcore.editcore-claude",
  provider: {
    default: {
      id: "editcore",
      name: "EditCore",
    },
  },
};

fs.writeFileSync(productPath, JSON.stringify(product, null, "\t") + "\n", "utf8");
console.log("OK: defaultChatAgent limpiado en", productPath);
