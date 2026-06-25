/**
 * El portable incluye StartupPageRunner (onboardingService) pero no registra
 * OnboardingVariationA. Sin este stub el workbench falla al crear startupPageRunner.
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

const MARKER = "EditCoreOnboardingStub";
const NEEDLE = 'var IOnboardingService = createDecorator("onboardingService");';
const STUB = `${NEEDLE}
registerSingleton(IOnboardingService, class ${MARKER} extends Disposable {
  constructor() { super(); }
  show() {}
  get onDidDismiss() { return Event2.None; }
}, 1 /* Delayed */);`;

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");
if (src.includes(MARKER)) {
  console.log("OK: stub onboarding ya aplicado ->", workbenchPath);
  process.exit(0);
}

if (!src.includes(NEEDLE)) {
  console.error("ERROR: no se encontró IOnboardingService en workbench");
  process.exit(1);
}

src = src.replace(NEEDLE, STUB);
fs.writeFileSync(workbenchPath, src, "utf8");
console.log("OK: stub onboarding registrado ->", workbenchPath);
