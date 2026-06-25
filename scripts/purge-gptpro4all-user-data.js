/**
 * Borra GPTPRO4ALL de perfil, cache, sesiones de chat y configuracion de modelos.
 * Cierra EditCore antes de ejecutar.
 */
const fs = require("fs");
const path = require("path");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const userRoot = path.join(process.env.APPDATA || "", "EditCore", "User");
const globalDb = path.join(userRoot, "globalStorage", "state.vscdb");
const chatModelsFile = path.join(userRoot, "chatLanguageModels.json");

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

function purgeDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return 0;
  }
  const db = new Database(dbPath);
  const del = db.prepare("DELETE FROM ItemTable WHERE key = ?");
  let removed = 0;

  for (const key of CACHE_KEYS) {
    if (del.run(key).changes > 0) {
      console.log("OK: eliminado", key, "en", dbPath);
      removed++;
    }
  }

  const stale = db
    .prepare("SELECT key FROM ItemTable WHERE value LIKE ? OR key LIKE ?")
    .all("%gptpro4all%", "%gptpro4all%");
  for (const row of stale) {
    if (!CACHE_KEYS.includes(row.key)) {
      del.run(row.key);
      console.log("OK: eliminado (stale)", row.key);
      removed++;
    }
  }

  db.close();
  return removed;
}

function purgeJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  if (!/gptpro4all/i.test(raw)) {
    return false;
  }
  if (filePath.endsWith("chatLanguageModels.json")) {
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ name: "EditCore", vendor: "editcore" }], null, "\t") + "\n",
      "utf8"
    );
    console.log("OK: chatLanguageModels.json -> vendor editcore");
    return true;
  }
  fs.unlinkSync(filePath);
  console.log("OK: eliminado", filePath);
  return true;
}

function walkAndPurge(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules") {
        continue;
      }
      walkAndPurge(full);
      continue;
    }
    if (/\.(jsonl|json)$/i.test(name) && /gptpro4all/i.test(fs.readFileSync(full, "utf8"))) {
      purgeJsonFile(full);
    }
    if (name === "state.vscdb") {
      purgeDb(full);
    }
  }
}

let total = 0;
total += purgeDb(globalDb);
purgeJsonFile(chatModelsFile);
walkAndPurge(path.join(userRoot, "globalStorage"));
walkAndPurge(path.join(userRoot, "workspaceStorage"));

console.log(
  total > 0
    ? `\nPerfil limpiado (${total} entradas en state global). Recarga EditCore (Ctrl+Alt+R).`
    : "\nPerfil sin restos GPTPRO4ALL en cache global."
);
