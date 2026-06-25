/**
 * Corrige grupos LM editcore con modelIdentifiers vacíos (rompía el picker).
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: editcore LM groups with model ids";
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
  console.log("OK: parche editcore LM groups ya aplicado");
  process.exit(0);
}

const from = `        if (vendorId === "editcore" && allModels.length > 0) { /* EditCore: skip LM group resolve for editcore */
          if (group2.settings) {
            for (const model of allModels) {
              const modelConfig = group2.settings[model.metadata.id];
              if (modelConfig) {
                perModelConfigurations.set(model.identifier, { ...modelConfig });
              }
            }
          }
          languageModelsGroups.push({ group: group2, modelIdentifiers: [] });
          continue;
        }`;

const to = `        if (vendorId === "editcore" && allModels.length > 0) { /* EditCore: skip LM group resolve for editcore */
          if (group2.settings) {
            for (const model of allModels) {
              const modelConfig = group2.settings[model.metadata.id];
              if (modelConfig) {
                perModelConfigurations.set(model.identifier, { ...modelConfig });
              }
            }
          }
          languageModelsGroups.push({ group: group2, modelIdentifiers: allModels.map((model) => model.identifier) }); /* ${MARKER} */
          continue;
        }`;

if (!src.includes(from)) {
  console.warn("WARN: bloque editcore LM groups no encontrado (quizá ya corregido)");
  process.exit(0);
}

src = src.replace(from, to);
fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: editcore LM groups ->", workbenchPath);
