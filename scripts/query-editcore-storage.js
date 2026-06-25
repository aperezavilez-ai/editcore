const fs = require("fs");
const path = require("path");

const dbPath =
  process.env.APPDATA +
  "/EditCore/User/globalStorage/state.vscdb";

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  try {
    Database = require(path.join(
      __dirname,
      "../VSCode-win32-x64/resources/app/node_modules.asar/better-sqlite3"
    ));
  } catch {
    console.error("better-sqlite3 no disponible");
    process.exit(1);
  }
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT key, value FROM ItemTable WHERE key LIKE '%disabled%' OR key LIKE '%extension%' OR value LIKE '%editcore%'`
  )
  .all();
for (const row of rows) {
  console.log("KEY:", row.key);
  console.log("VALUE:", row.value?.slice?.(0, 500) ?? row.value);
  console.log("---");
}
