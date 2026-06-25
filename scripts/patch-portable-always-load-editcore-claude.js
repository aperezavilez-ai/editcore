/**
 * Incluye editcore.editcore-claude y editcore.editcore-connect en el extension host aunque el enablement las filtre.
 */
const fs = require("fs");
const path = require("path");

const MARKER_FILTER = "EditCore: always load editcore extensions";
const MARKER_RESOLVE = "EditCore: force localExtensions editcore extensions";
const EC_IDS = new Set(["editcore.editcore-claude", "editcore.editcore-connect"]);
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

const OLD_MARKER_FILTER = "EditCore: always load editcore-claude";
const OLD_MARKER_RESOLVE = "EditCore: force localExtensions editcore-claude";

if (src.includes(OLD_MARKER_FILTER) && !src.includes(MARKER_FILTER)) {
  src = src.replace(
    `    if (extensionEnablementService.isEnabledEnablementState(enablementStates[index2]) || extensionsToCheck[index2].identifier.id === "editcore.editcore-claude") { /* ${OLD_MARKER_FILTER} */`,
    `    const __ecId = extensionsToCheck[index2].identifier.id || extensionsToCheck[index2].identifier.value;
    if (extensionEnablementService.isEnabledEnablementState(enablementStates[index2]) || __ecId === "editcore.editcore-claude" || __ecId === "editcore.editcore-connect") { /* ${MARKER_FILTER} */`
  );
  applied++;
}

if (src.includes(OLD_MARKER_RESOLVE) && !src.includes(MARKER_RESOLVE)) {
  src = src.replace(
    `        const __ecForce = extensions.extensions.find((e) => (e.identifier.id || e.identifier.value) === "editcore.editcore-claude");
        if (__ecForce && !localExtensions.some((e) => ExtensionIdentifier.equals(e.identifier, __ecForce.identifier))) {
          localExtensions.push(__ecForce); /* ${OLD_MARKER_RESOLVE} */
        }`,
    `        const __ecForce = extensions.extensions.filter((e) => {
          const id = e.identifier.id || e.identifier.value;
          return id === "editcore.editcore-claude" || id === "editcore.editcore-connect";
        });
        for (const __ecExt of __ecForce) {
          if (!localExtensions.some((e) => ExtensionIdentifier.equals(e.identifier, __ecExt.identifier))) {
            localExtensions.push(__ecExt); /* ${MARKER_RESOLVE} */
          }
        }`
  );
  applied++;
}

if (!src.includes(MARKER_FILTER) && !src.includes(OLD_MARKER_FILTER)) {
  const fromFilter = `    if (extensionEnablementService.isEnabledEnablementState(enablementStates[index2])) {
      enabledExtensions.push(extensionsToCheck[index2]);
    } else {`;
  const toFilter = `  const __ecId = extensionsToCheck[index2].identifier.id || extensionsToCheck[index2].identifier.value;
    if (extensionEnablementService.isEnabledEnablementState(enablementStates[index2]) || __ecId === "editcore.editcore-claude" || __ecId === "editcore.editcore-connect") { /* ${MARKER_FILTER} */
      enabledExtensions.push(extensionsToCheck[index2]);
    } else {`;
  if (!src.includes(fromFilter)) {
    console.warn("WARN: bloque filterEnabledExtensions no encontrado");
  } else {
    src = src.replace(fromFilter, toFilter);
    applied++;
  }
}

if (!src.includes(MARKER_RESOLVE) && !src.includes(OLD_MARKER_RESOLVE)) {
  const fromResolve = `      if (extensions instanceof LocalExtensions) {
        localExtensions = checkEnabledAndProposedAPI(this._logService, this._extensionEnablementService, this._extensionsProposedApi, extensions.extensions, false);
      }`;
  const toResolve = `      if (extensions instanceof LocalExtensions) {
        localExtensions = checkEnabledAndProposedAPI(this._logService, this._extensionEnablementService, this._extensionsProposedApi, extensions.extensions, false);
        const __ecForce = extensions.extensions.filter((e) => {
          const id = e.identifier.id || e.identifier.value;
          return id === "editcore.editcore-claude" || id === "editcore.editcore-connect";
        });
        for (const __ecExt of __ecForce) {
          if (!localExtensions.some((e) => ExtensionIdentifier.equals(e.identifier, __ecExt.identifier))) {
            localExtensions.push(__ecExt); /* ${MARKER_RESOLVE} */
          }
        }
      }`;
  if (!src.includes(fromResolve)) {
    console.warn("WARN: bloque LocalExtensions no encontrado");
  } else {
    src = src.replace(fromResolve, toResolve);
    applied++;
  }
}

if (applied === 0) {
  console.log("OK: parches always-load editcore extensions ya aplicados");
  process.exit(0);
}

fs.writeFileSync(workbenchPath, src, "utf8");
console.log(`OK: ${applied} parche(s) always-load ->`, workbenchPath);
