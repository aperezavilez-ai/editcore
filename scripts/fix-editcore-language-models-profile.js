/**
 * Evita grupos LM de editcore en chatLanguageModels.json que duplican modelos
 * (editcore/id vs editcore/EditCore/id). Cierra EditCore antes de ejecutar.
 */
const fs = require("fs");
const path = require("path");

const profileFile = path.join(
  process.env.APPDATA || "",
  "EditCore",
  "User",
  "chatLanguageModels.json"
);

if (!fs.existsSync(profileFile)) {
  console.log("SKIP: no existe", profileFile);
  process.exit(0);
}

let groups;
try {
  groups = JSON.parse(fs.readFileSync(profileFile, "utf8"));
} catch (err) {
  console.warn("WARN: no se pudo leer chatLanguageModels.json:", err.message);
  process.exit(0);
}

if (!Array.isArray(groups)) {
  console.log("SKIP: formato inesperado en chatLanguageModels.json");
  process.exit(0);
}

const filtered = groups.filter((g) => g && g.vendor !== "editcore");
if (filtered.length === groups.length) {
  console.log("OK: sin grupos editcore en chatLanguageModels.json");
  process.exit(0);
}

fs.writeFileSync(profileFile, JSON.stringify(filtered, null, "\t") + "\n", "utf8");
console.log("OK: eliminados grupos editcore de", profileFile);
