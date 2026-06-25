/**
 * Habilita editcore.editcore-claude si VS Code la desactivó por "chat setup".
 * Cierra EditCore antes de ejecutar.
 */
const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const CLAUDE_ID = "editcore.editcore-claude";
const DISABLED_KEY = "extensionsIdentifiers/disabled";
const MIGRATION_KEY = "builtinChatExtensionEnablementMigration";

const dbPaths = [
  path.join(process.env.APPDATA, "EditCore/User/globalStorage/state.vscdb"),
];

function fixDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.log("SKIP (no existe):", dbPath);
    return false;
  }

  const db = new Database(dbPath);
  let changed = false;

  const get = db.prepare("SELECT value FROM ItemTable WHERE key = ?");

  const disabledRow = get.get(DISABLED_KEY);
  if (disabledRow?.value) {
    try {
      const list = JSON.parse(disabledRow.value);
      const filtered = list.filter(
        (e) => (e.id || e).toLowerCase() !== CLAUDE_ID
      );
      if (filtered.length !== list.length) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)"
        );
        if (filtered.length === 0) {
          db.prepare("DELETE FROM ItemTable WHERE key = ?").run(DISABLED_KEY);
        } else {
          stmt.run(DISABLED_KEY, JSON.stringify(filtered));
        }
        console.log("OK: eliminada de disabled en", dbPath);
        changed = true;
      } else {
        console.log("INFO: no estaba en disabled:", dbPath);
      }
    } catch (e) {
      console.warn("WARN: no se pudo parsear disabled:", e.message);
    }
  } else {
    console.log("INFO: sin lista disabled en", dbPath);
  }

  // chat.setupContext: VS Code marca el chat como disabled hasta "setup"
  const chatRow = get.get("chat.setupContext");
  if (chatRow?.value) {
    try {
      const ctx = JSON.parse(chatRow.value);
      if (ctx.disabled) {
        ctx.disabled = false;
        ctx.installed = true;
        db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
          "chat.setupContext",
          JSON.stringify(ctx)
        );
        console.log("OK: chat.setupContext.disabled = false");
        changed = true;
      }
    } catch (e) {
      console.warn("WARN: chat.setupContext:", e.message);
    }
  }

  // Marcar migración como hecha (evita re-deshabilitar en builds sin parche)
  const mig = get.get(MIGRATION_KEY);
  if (!mig) {
    db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)").run(
      MIGRATION_KEY,
      "true"
    );
    console.log("OK: migration key establecida");
    changed = true;
  }

  db.close();
  return changed;
}

function clearModelCache(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return false;
  }
  const db = new Database(dbPath);
  const keys = [
    "chat.cachedLanguageModels.v2",
    "chat.cachedLanguageModels",
    "chatModelRecentlyUsed",
    "chatModelPinned",
    "chat.currentLanguageModel.panel",
    "chat.currentLanguageModel.panel.isDefault",
  ];
  let removed = 0;
  for (const key of keys) {
    const r = db.prepare("DELETE FROM ItemTable WHERE key = ?").run(key);
    if (r.changes > 0) {
      console.log("OK: cache eliminada:", key);
      removed++;
    }
  }
  db.close();
  return removed > 0;
}

let any = false;
for (const p of dbPaths) {
  if (fixDb(p)) any = true;
  if (clearModelCache(p)) any = true;
}

if (any) {
  console.log("\nListo. Abre VSCode-win32-x64\\EditCore.exe y recarga (Ctrl+Alt+R).");
} else {
  console.log("\nSin cambios en storage. Si el error persiste, habilita manualmente en Extensiones.");
}
