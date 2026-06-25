const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const dbPath = path.join(process.env.APPDATA || "", "EditCore", "User", "globalStorage", "state.vscdb");
if (!fs.existsSync(dbPath)) {
  console.log("NO DB", dbPath);
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare("SELECT key FROM ItemTable WHERE key LIKE '%chat%' OR key LIKE '%model%' OR key LIKE '%Language%'")
  .all();
console.log("KEYS:", rows.map((r) => r.key).sort().join("\n"));

const cached = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("chat.cachedLanguageModels.v2");
if (cached) {
  const models = JSON.parse(cached.value);
  console.log("\nCACHED MODELS (" + models.length + "):");
  for (const m of models) {
    console.log(" ", m.identifier, "->", m.metadata?.name);
  }
}

const profileLm = path.join(process.env.APPDATA || "", "EditCore", "User", "languageModels.json");
if (fs.existsSync(profileLm)) {
  console.log("\nlanguageModels.json:\n", fs.readFileSync(profileLm, "utf8"));
}

db.close();
