// Genera .editcore/graph.json con el grafo de dependencias real de los módulos TypeScript
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'extensions', 'editcore-claude', 'src');
const OUT = path.join(ROOT, '.editcore', 'graph.json');
const SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'build', 'coverage']);

const nodes = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { walk(abs); continue; }
    if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;

    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    let content;
    try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }

    const imports = [];
    const re = /from\s+['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      imports.push(m[1]);
    }
    nodes.push({ id: rel, imports });
  }
}

walk(SRC);

const graph = { generatedAt: new Date().toISOString(), nodes };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(graph, null, 2), 'utf8');
console.log('OK: .editcore/graph.json generado con', nodes.length, 'nodos');
