/**
 * Evita el modal "Sign in to use GitHub Copilot" cuando EditCore usa APIs propias.
 * Cierra EditCore antes de ejecutar.
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

const MARKER = "EditCore: skip Copilot chat setup";

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");
if (src.includes(MARKER)) {
  console.log("OK: parche Copilot chat setup ya aplicado");
  process.exit(0);
}

const replacements = [
  {
    from: `const hasGptPro4AllModels = languageModelsService.getLanguageModelIds().some((id) => id.startsWith(\`\${GPTPRO4ALL_VENDOR_ID}/\`));
    if (hasGptPro4AllModels) {
      return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
    }`,
    to: `const hasEditCoreModels = languageModelsService.getLanguageModelIds().some((id) => id.startsWith("editcore/"));
    if (hasEditCoreModels || hasByokModels) { /* ${MARKER} */
      return this.doInvokeWithoutSetup(request2, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
    }`,
  },
  {
    from: `async doInvokeWithSetup(request2, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService, defaultAccountService) {
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "chat" });`,
    to: `async doInvokeWithSetup(request2, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService, defaultAccountService) {
    return this.doInvokeWithoutSetup(request2, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService); /* ${MARKER} */
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "chat" });`,
  },
  {
    from: `const hasGptPro4AllModel = this._languageModelsService.getLanguageModelIds().some((id) => id.startsWith(\`\${GPTPRO4ALL_VENDOR_ID}/\`));
    if (hasGptPro4AllModel) {`,
    to: `const hasEditCoreModel = this._languageModelsService.getLanguageModelIds().some((id) => id.startsWith("editcore/"));
    if (hasEditCoreModel) { /* ${MARKER} */`,
  },
  {
    from: `const hasGptPro4AllVendor = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().some((g) => g.vendor === GPTPRO4ALL_VENDOR_ID);
    if (hasGptPro4AllVendor) {`,
    to: `const hasEditCoreVendor = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().some((g) => g.vendor === "editcore");
    if (hasEditCoreVendor) { /* ${MARKER} */`,
  },
  {
    from: `const hasEditCoreNativeProvider = configurableVendors.some((vendor) => vendor.vendor === "gptpro4all");`,
    to: `const hasEditCoreNativeProvider = configurableVendors.some((vendor) => vendor.vendor === "editcore"); /* ${MARKER} */`,
  },
];

let applied = 0;
for (const { from, to } of replacements) {
  if (!src.includes(from)) {
    console.warn("WARN: bloque no encontrado, omitido:", from.slice(0, 60).replace(/\n/g, " "));
    continue;
  }
  src = src.replace(from, to);
  applied++;
}

if (applied === 0) {
  console.error("ERROR: no se aplicó ningún parche");
  process.exit(1);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parches Copilot/setup ->`, workbenchPath);
