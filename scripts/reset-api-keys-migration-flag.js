/**
 * Resetea la flag de migración api-keys.json y opcionalmente secrets de Claude.
 * Uso (EditCore cerrado):
 *   node scripts/reset-api-keys-migration-flag.js
 *   node scripts/reset-api-keys-migration-flag.js --with-secrets
 *   node scripts/reset-api-keys-migration-flag.js --with-secrets --recreate-json
 */
const fs = require("fs");
const path = require("path");

const FLAG = "editcore.apiKeys.migratedFromFile.v1";
const EXT_KEY = "editcore.editcore-claude";
const CONNECT_SYNC_FLAG = "editcoreConnect.apiKeys.syncedFromConnectSecrets.v1";
const CONNECT_EXT_KEY = "editcore.editcore-connect";

const args = new Set(process.argv.slice(2));
const withSecrets = args.has("--with-secrets");
const recreateJson = args.has("--recreate-json");

const dbPath = path.join(
  process.env.APPDATA || "",
  "EditCore",
  "User",
  "globalStorage",
  "state.vscdb"
);
const keysFile = path.join(process.env.APPDATA || "", "EditCore", "api-keys.json");

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(path.join(__dirname, "node_modules", "better-sqlite3"));
}

if (!fs.existsSync(dbPath)) {
  console.error("No existe state.vscdb:", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

function loadState(key) {
  const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
  if (!row?.value) return null;
  return JSON.parse(row.value);
}

function saveState(key, state) {
  db.prepare("UPDATE ItemTable SET value = ? WHERE key = ?").run(JSON.stringify(state), key);
}

// 1) Flag migración Claude
const claudeState = loadState(EXT_KEY);
if (claudeState) {
  if (FLAG in claudeState) {
    delete claudeState[FLAG];
    saveState(EXT_KEY, claudeState);
    console.log("OK: borrada flag", FLAG);
  } else {
    console.log("Info: flag no presente ->", FLAG);
  }
} else {
  console.log("Info: sin fila", EXT_KEY);
}

// 2) Flag sync Connect (opcional pero útil en retests)
const connectState = loadState(CONNECT_EXT_KEY);
if (connectState) {
  if (CONNECT_SYNC_FLAG in connectState) {
    delete connectState[CONNECT_SYNC_FLAG];
    saveState(CONNECT_EXT_KEY, connectState);
    console.log("OK: borrada flag", CONNECT_SYNC_FLAG);
  }
}

// 3) Secrets Claude
if (withSecrets) {
  const rows = db
    .prepare("SELECT key FROM ItemTable WHERE key LIKE ?")
    .all("secret://%editcore.editcore-claude%");
  for (const row of rows) {
    if (row.key.includes("anthropicApiKey") || row.key.includes("openaiApiKey")) {
      db.prepare("DELETE FROM ItemTable WHERE key = ?").run(row.key);
      console.log("OK: secret borrado ->", row.key);
    }
  }
}

db.close();

// 4) Recrear api-keys.json UTF-8 sin BOM (PS 5.1 compatible vía Node)
if (recreateJson) {
  fs.mkdirSync(path.dirname(keysFile), { recursive: true });
  const payload = {
    anthropic: "sk-ant-test-migracion",
    openai: "sk-test-migracion",
  };
  fs.writeFileSync(keysFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("OK: recreado", keysFile);
}

console.log("");
console.log("Listo. Abre EditCore y filtra DevTools: [EditCore migrate]");
