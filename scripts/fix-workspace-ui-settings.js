/**
 * Evita que al abrir un folder desaparezcan chat, browser, APIs y EditCore Connect.
 * Cierra EditCore antes de ejecutar.
 */
const fs = require("fs");
const path = require("path");
const Database = require(path.join(__dirname, "node_modules", "better-sqlite3"));

const settingsPath = path.join(
  process.env.APPDATA || "",
  "EditCore",
  "User",
  "settings.json"
);

const defaultsPath = path.join(__dirname, "..", "branding", "default-settings.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim() || "{}");
}

const defaults = readJson(defaultsPath);
const settings = readJson(settingsPath);
const merged = { ...settings, ...defaults };
delete merged["workbench.secondarySideBar.defaultVisibility.hidden"];
if (merged["workbench.secondarySideBar.defaultVisibility"] === "hidden") {
  merged["workbench.secondarySideBar.defaultVisibility"] = "visible";
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log("OK: settings workspace/trust/browser ->", settingsPath);

const dbPath = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");
if (!fs.existsSync(dbPath)) {
  process.exit(0);
}

const db = new Database(dbPath);
const keysToFix = [
  "workbench.activity.pinnedViewlets2",
  "workbench.auxiliarybar.pinnedPanels",
  "workbench.panel.pinnedPanels",
];

for (const key of keysToFix) {
  const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
  if (!row?.value) {
    continue;
  }
  try {
    const list = JSON.parse(row.value);
    let fixed = 0;
    for (const item of list) {
      if (item.visible === false) {
        item.visible = true;
        fixed++;
      }
      if (item.isHidden === true) {
        item.isHidden = false;
        fixed++;
      }
    }
    if (fixed > 0) {
      db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
        key,
        JSON.stringify(list)
      );
      console.log(`OK: ${fixed} entradas visibles en ${key}`);
    }
  } catch (e) {
    console.warn("WARN:", key, e.message);
  }
}

const hiddenKeys = db
  .prepare("SELECT key, value FROM ItemTable WHERE key LIKE '%hidden%' AND key LIKE '%editcore%'")
  .all();
for (const row of hiddenKeys) {
  try {
    const list = JSON.parse(row.value);
    let touch = false;
    for (const item of list) {
      if (item.isHidden) {
        item.isHidden = false;
        touch = true;
      }
    }
    if (touch) {
      db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
        row.key,
        JSON.stringify(list)
      );
      console.log("OK: vistas EditCore visibles ->", row.key);
    }
  } catch {
    // ignore
  }
}

db.close();

const workspaceRoot = path.join(process.env.APPDATA || "", "EditCore", "User", "workspaceStorage");
if (fs.existsSync(workspaceRoot)) {
  for (const dir of fs.readdirSync(workspaceRoot)) {
    const wsDb = path.join(workspaceRoot, dir, "state.vscdb");
    if (!fs.existsSync(wsDb)) {
      continue;
    }
    try {
      const ws = new Database(wsDb);
      for (const key of keysToFix) {
        const row = ws.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
        if (!row?.value) {
          continue;
        }
        const list = JSON.parse(row.value);
        let fixed = 0;
        for (const item of list) {
          if (item.visible === false) {
            item.visible = true;
            fixed++;
          }
          if (item.isHidden === true) {
            item.isHidden = false;
            fixed++;
          }
        }
        if (fixed > 0) {
          ws.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
            key,
            JSON.stringify(list)
          );
          console.log(`OK: workspace ${dir}: ${fixed} visibles en ${key}`);
        }
      }
      ws.close();
    } catch (e) {
      console.warn("WARN: workspace", dir, e.message);
    }
  }
}
