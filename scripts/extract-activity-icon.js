const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "../extensions/editcore-claude/media/editcore-icon.svg");
const outPath = path.join(__dirname, "../extensions/editcore-claude/media/editcore-activity.png");
const svg = fs.readFileSync(svgPath, "utf8");
const match = svg.match(/base64,([^"]+)/);
if (!match) {
  throw new Error("No base64 image in editcore-icon.svg");
}
fs.writeFileSync(outPath, Buffer.from(match[1], "base64"));
console.log("Wrote", outPath, fs.statSync(outPath).size, "bytes");
