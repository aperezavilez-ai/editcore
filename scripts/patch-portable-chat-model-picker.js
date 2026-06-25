/**
 * EditCore: selector de modelos explícito (Claude + OpenAI), sin modo "Auto",
 * sin duplicados por grupos LM (editcore/id vs editcore/EditCore/id).
 */
const fs = require("fs");
const path = require("path");

const MARKER_AUTO = "EditCore: sin modo Auto en selector de modelos";
const MARKER_INIT = "EditCore: modelo concreto por defecto";
const MARKER_SKIP_GROUPS = "EditCore: skip LM group resolve for editcore";
const MARKER_DEDUPE = "EditCore: dedupe language models by metadata.id";

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

function tryPatch({ marker, from, to, label }) {
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

tryPatch({
  marker: MARKER_AUTO,
  label: "_showAutoModel",
  from: `  _showAutoModel() {
    const sessionType = this.getCurrentSessionType();
    return !sessionType || this.chatSessionsService.supportsAutoModelForSessionType(sessionType);
  }`,
  to: `  _showAutoModel() {
    if (product_default.applicationName === "editcore") {
      return false; /* ${MARKER_AUTO} */
    }
    const sessionType = this.getCurrentSessionType();
    return !sessionType || this.chatSessionsService.supportsAutoModelForSessionType(sessionType);
  }`,
});

tryPatch({
  marker: MARKER_INIT,
  label: "initSelectedModel",
  from: `          } else {
            this.setCurrentLanguageModelToDefault();
          }
        });
      }
    }
  }
  setEditing(enabled, editingSentRequest) {`,
  to: `          } else {
            this.setCurrentLanguageModelToDefault();
          }
        });
      }
    }
    if (product_default.applicationName === "editcore" && !this._currentLanguageModel.get()) {
      this.setCurrentLanguageModelToDefault(); /* ${MARKER_INIT} */
    }
  }
  setEditing(enabled, editingSentRequest) {`,
});

tryPatch({
  marker: MARKER_SKIP_GROUPS,
  label: "_resolveAllLanguageModels editcore groups",
  from: `      for (const group2 of groups) {
        if (group2.vendor !== vendorId) {
          continue;
        }
        if (vendorId === "gptpro4all" && allModels.length > 0) {`,
  to: `      for (const group2 of groups) {
        if (group2.vendor !== vendorId) {
          continue;
        }
        if (vendorId === "editcore" && allModels.length > 0) { /* ${MARKER_SKIP_GROUPS} */
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
        }
        if (vendorId === "gptpro4all" && allModels.length > 0) {`,
});

tryPatch({
  marker: MARKER_DEDUPE,
  label: "getModelsForSessionType dedupe",
  from: `    allModels.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
    const sessionFiltered = filterModelsForSession(allModels, sessionType, this.currentModeKind, this.location);
    return sessionFiltered.filter((m) => !this.languageModelsService.isModelHidden(m.identifier));
  }`,
  to: `    allModels.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
    const sessionFiltered = filterModelsForSession(allModels, sessionType, this.currentModeKind, this.location);
    const visible = sessionFiltered.filter((m) => !this.languageModelsService.isModelHidden(m.identifier));
    if (product_default.applicationName === "editcore") { /* ${MARKER_DEDUPE} */
      const unique = /* @__PURE__ */ new Map();
      for (const model of visible) {
        const key = model.metadata.vendor + "\\0" + model.metadata.id;
        const existing = unique.get(key);
        if (!existing || model.identifier.split("/").length < existing.identifier.split("/").length) {
          unique.set(key, model);
        }
      }
      return Array.from(unique.values());
    }
    return visible;
  }`,
});

if (applied === 0) {
  const allMarkers = [MARKER_AUTO, MARKER_INIT, MARKER_SKIP_GROUPS, MARKER_DEDUPE];
  if (allMarkers.every((m) => src.includes(m))) {
    console.log("OK: parche model picker ya aplicado");
  } else {
    console.warn("WARN: faltan parches model picker; revisa workbench.desktop.main.js");
  }
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) model picker ->`, workbenchPath);
