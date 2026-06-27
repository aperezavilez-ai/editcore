const path = require("path");
const fs = require("fs");

const dbPath = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");
const keysFile = path.join(process.env.APPDATA || "", "EditCore", "api-keys.json");

console.log("api-keys.json:", keysFile, "exists:", fs.existsSync(keysFile));
console.log("state.vscdb:", dbPath, "exists:", fs.existsSync(dbPath));

if (!fs.existsSync(dbPath)) {
  process.exit(0);
}

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(path.join(__dirname, "node_modules", "better-sqlite3"));
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT key, length(value) as len FROM ItemTable
     WHERE key LIKE '%secret%'
        OR key LIKE '%anthropic%'
        OR key LIKE '%openai%'
        OR key LIKE '%apiKeys%'
        OR key LIKE '%editcore.editcore-claude%'`
  )
  .all();

console.log("\nMatching keys in state.vscdb:");
for (const r of rows) {
  console.log(`  ${r.key} (value length: ${r.len})`);
}

const migrationInState = db
  .prepare(`SELECT value FROM ItemTable WHERE key = 'editcore.editcore-claude'`)
  .get();
if (migrationInState?.value) {
  try {
    const parsed = JSON.parse(migrationInState.value);
    console.log("\neditcore.editcore-claude globalState:");
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log("\neditcore.editcore-claude raw:", migrationInState.value.slice(0, 300));
  }
}

const claudeSecrets = db
  .prepare(`SELECT key FROM ItemTable WHERE key LIKE '%editcore.editcore-claude%' AND key LIKE '%secret%'`)
  .all();
console.log("\nClaude extension secrets in DB:", claudeSecrets.length);
for (const r of claudeSecrets) console.log(" ", r.key);

const connectSecrets = db
  .prepare(`SELECT key FROM ItemTable WHERE key LIKE '%editcore.editcore-connect%' AND key LIKE '%secret%'`)
  .all();
console.log("\nConnect extension secrets in DB:", connectSecrets.length);
for (const r of connectSecrets) console.log(" ", r.key);

const connectState = db
  .prepare(`SELECT value FROM ItemTable WHERE key = 'editcore.editcore-connect'`)
  .get();
if (connectState?.value) {
  try {
    console.log("\neditcore.editcore-connect globalState:");
    console.log(JSON.stringify(JSON.parse(connectState.value), null, 2));
  } catch {
    console.log("\neditcore.editcore-connect raw:", connectState.value.slice(0, 300));
  }
}

db.close();
