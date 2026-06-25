const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "node_modules/better-sqlite3"));

const paths = [
  path.join(process.env.APPDATA, "EditCore/User/globalStorage/state.vscdb"),
  path.join(
    process.env.APPDATA,
    "EditCore/User/workspaceStorage/1729b448402871a352feb1eb2f5b7ef2/state.vscdb"
  ),
];

for (const dbPath of paths) {
  if (!fs.existsSync(dbPath)) {
    console.log("MISSING", dbPath);
    continue;
  }
  console.log("\n===", dbPath, "===");
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare(
      `SELECT key, value FROM ItemTable WHERE key LIKE '%disabled%' OR key LIKE '%extension%' OR key LIKE '%chat%' OR value LIKE '%editcore%'`
    )
    .all();
  for (const r of rows) {
    console.log("---", r.key);
    console.log((r.value || "").slice(0, 400));
  }
  db.close();
}
