#!/usr/bin/env node
/**
 * Aplica parches EditCore sobre editcore-src (Code-OSS).
 * Idempotente: omite parches ya aplicados.
 */
const fs = require('fs');
const path = require('path');
const { PATCHES } = require('./editcore-patches.cjs');

const repoRoot = process.argv[2];
if (!repoRoot) {
  console.error('Uso: node apply-editcore-patches.js <ruta-editcore-src>');
  process.exit(1);
}

let applied = 0;
let skipped = 0;
let warnings = 0;

for (const patch of PATCHES) {
  const filePath = path.join(repoRoot, patch.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`WARN parche omitido (no existe): ${patch.file}`);
    warnings++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (patch.marker && content.includes(patch.marker)) {
    skipped++;
    continue;
  }

  if (!content.includes(patch.old)) {
    if (content.includes(patch.new.trim().substring(0, 60))) {
      skipped++;
      continue;
    }
    console.warn(`WARN patrón no encontrado en ${patch.file} — ${patch.label || 'sin etiqueta'}`);
    warnings++;
    continue;
  }

  content = content.replace(patch.old, patch.new);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`PATCH ${patch.file} — ${patch.label || 'ok'}`);
  applied++;
}

console.log(`\nParches EditCore: ${applied} aplicados, ${skipped} ya presentes, ${warnings} advertencias.`);
