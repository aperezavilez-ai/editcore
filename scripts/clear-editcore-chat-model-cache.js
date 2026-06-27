/**
 * Borra modelos de chat cacheados (p. ej. vendor gptpro4all obsoleto).
 * Cierra EditCore antes de ejecutar.
 */
const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const CACHE_KEYS = [
  "chat.cachedLanguageModels.v2",
  "chat.cachedLanguageModels",
  "chatModelRecentlyUsed",
  "chatModelPinned",
  "chat.currentLanguageModel.panel",
  "chat.currentLanguageModel.panel.isDefault",
  "chat.currentLanguageModel.editor",
  "chat.currentLanguageModel.editor.isDefault",
];

const dbPath = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");

if (!fs.existsSync(dbPath)) {
  console.log("SKIP: no existe", dbPath);
  process.exit(0);
}

const db = new Database(dbPath);
const get = db.prepare("SELECT value FROM ItemTable WHERE key = ?");
const del = db.prepare("DELETE FROM ItemTable WHERE key = ?");

let removed = 0;
for (const key of CACHE_KEYS) {
  if (get.get(key)) {
    del.run(key);
    console.log("OK: eliminado", key);
    removed++;
  }
}

// Cualquier clave con modelos retirados u obsoletos en el valor
const stalePatterns = ["%gptpro4all%", "%claude-sonnet-4-20250514%", "%claude-opus-4-20250514%", "%20250514%"];
for (const pattern of stalePatterns) {
  const stale = db
    .prepare("SELECT key FROM ItemTable WHERE value LIKE ? OR key LIKE ?")
    .all(pattern, pattern.replace(/%/g, ""));
  for (const row of stale) {
    if (!CACHE_KEYS.includes(row.key)) {
      del.run(row.key);
      console.log("OK: eliminado (stale)", row.key);
      removed++;
    }
  }
}

db.close();

if (removed > 0) {
  console.log(`\nCache de modelos limpiada (${removed} entradas). Abre EditCore y recarga (Ctrl+Alt+R).`);
} else {
  console.log("\nNo habia cache de modelos que limpiar.");
}
