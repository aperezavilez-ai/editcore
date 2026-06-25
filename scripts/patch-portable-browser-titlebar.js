/**
 * Muestra el icono Browser (globo) en la barra superior cuando showInTitleBar está activo.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: browser siempre en title bar";
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
  console.log("OK: parche browser titlebar ya aplicado");
  process.exit(0);
}

const from = `        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.workbench.browser.showInTitleBar", false).negate(),
          ContextKeyExpr.or(
            CONTEXT_BROWSER_EDITOR_OPEN,
            // This is a hack to work around \`true\` just testing for truthiness of the key. It works since \`1 == true\` in JS.
            ContextKeyExpr.equals("config.workbench.browser.showInTitleBar", 1)
          )
        )`;
const to = `        when: ContextKeyExpr.equals("config.workbench.browser.showInTitleBar", false).negate() /* ${MARKER} */`;

if (!src.includes(from)) {
  console.warn("WARN: bloque browser titlebar no encontrado");
  process.exit(0);
}

src = src.replace(from, to);
fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: browser titlebar ->", workbenchPath);
