/**
 * Quita el proveedor GPTPRO4ALL incrustado en workbench.desktop.main.js del portable.
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

const MARKER = "EditCore: GPTPRO4ALL removed";

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");

if (src.includes(MARKER)) {
  console.log("OK: parche GPTPRO4ALL ya aplicado");
  process.exit(0);
}

if (!src.includes("GPTPRO4ALL_VENDOR_ID")) {
  console.log("OK: workbench sin GPTPRO4ALL");
  process.exit(0);
}

src = src.replace(
  "this._registerGptPro4AllBuiltinProvider();",
  `/* ${MARKER} */`
);

src = src.replace(
  "_registerGptPro4AllBuiltinProvider() {",
  `_registerGptPro4AllBuiltinProvider() { return; /* ${MARKER} */`
);

src = src.replaceAll(
  "EditCore GPTPRO4ALL is getting ready",
  "EditCore is getting ready"
);

fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: GPTPRO4ALL desactivado en workbench ->", workbenchPath);
