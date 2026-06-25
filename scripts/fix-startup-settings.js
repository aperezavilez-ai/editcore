/** Arreglo inmediato: welcomePage + onboarding off = pantalla negra. */
const fs = require("fs");
const path = require("path");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const settingsPath = path.join(
  process.env.APPDATA || "",
  "EditCore",
  "User",
  "settings.json"
);

if (!fs.existsSync(settingsPath)) {
  console.log("skip:", settingsPath);
  process.exit(0);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, ""));
settings["workbench.startupEditor"] = "none";
settings["chat.tips.enabled"] = false;
delete settings["workbench.startupEditor.welcomePage"];
delete settings["workbench.secondarySideBar.defaultVisibility.hidden"];
if (settings["workbench.secondarySideBar.defaultVisibility"] === "hidden") {
  settings["workbench.secondarySideBar.defaultVisibility"] = "visible";
}
const defaultsPath = path.join(__dirname, "..", "branding", "default-settings.json");
if (fs.existsSync(defaultsPath)) {
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8").replace(/^\uFEFF/, ""));
  Object.assign(settings, {
    "security.workspace.trust.enabled": defaults["security.workspace.trust.enabled"],
    "security.workspace.trust.startupPrompt": defaults["security.workspace.trust.startupPrompt"],
    "security.workspace.trust.banner": defaults["security.workspace.trust.banner"],
    "security.workspace.trust.untrustedFiles": defaults["security.workspace.trust.untrustedFiles"],
    "workbench.browser.showInTitleBar": defaults["workbench.browser.showInTitleBar"],
    "workbench.browser.openLocalhostLinks": defaults["workbench.browser.openLocalhostLinks"],
    "workbench.secondarySideBar.defaultVisibility":
      defaults["workbench.secondarySideBar.defaultVisibility"],
    "terminal.integrated.initialHint": defaults["terminal.integrated.initialHint"],
    "terminal.integrated.initialHintCopilotCli":
      defaults["terminal.integrated.initialHintCopilotCli"],
  });
}
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
console.log("OK: workbench.startupEditor = none ->", settingsPath);

const dbPath = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");
if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath);
  const key = "workbench.activity.pinnedViewlets2";
  const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
  if (row?.value) {
    try {
      const list = JSON.parse(row.value);
      let fixed = 0;
      for (const v of list) {
        if (v.visible === false) {
          v.visible = true;
          fixed++;
        }
      }
      if (fixed > 0) {
        db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
          key,
          JSON.stringify(list)
        );
        console.log(`OK: ${fixed} viewlets visibles en activity bar`);
      }
    } catch (e) {
      console.warn("WARN: pinnedViewlets2:", e.message);
    }
  }
  db.close();
}

const dbPath2 = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");
if (fs.existsSync(dbPath2)) {
  const db = new Database(dbPath2);
  const chatRow = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("chat.setupContext");
  const chat = chatRow?.value
    ? JSON.parse(chatRow.value)
    : {
        entitlement: 1,
        installed: true,
        disabled: false,
        untrusted: false,
        disabledInWorkspace: false,
        hidden: false,
      };
  if (chat.disabled || !chat.installed) {
    chat.disabled = false;
    chat.installed = true;
    db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
      "chat.setupContext",
      JSON.stringify(chat)
    );
    console.log("OK: chat.setupContext -> chat habilitado");
  }
  db.close();
}
