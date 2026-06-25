#!/usr/bin/env node
/**
 * Recalcula product.json checksums tras rebrand o parches en out/.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHECKSUM_FILES = [
  'vs/base/parts/sandbox/electron-browser/preload.js',
  'vs/workbench/workbench.desktop.main.js',
  'vs/workbench/workbench.desktop.main.css',
  'vs/workbench/api/node/extensionHostProcess.js',
  'vs/code/electron-browser/workbench/workbench.html',
  'vs/code/electron-browser/workbench/workbench.js',
  'vs/sessions/sessions.desktop.main.js',
  'vs/sessions/sessions.desktop.main.css',
  'vs/sessions/electron-browser/sessions.html',
  'vs/sessions/electron-browser/sessions.js',
];

function sha256Base64(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('base64').replace(/=+$/, '');
}

function updateProduct(productPath, outDir) {
  if (!fs.existsSync(productPath)) {
    console.warn('skip (no existe):', productPath);
    return false;
  }
  const product = JSON.parse(fs.readFileSync(productPath, 'utf8').replace(/^\uFEFF/, ''));
  const checksums = {};
  for (const rel of CHECKSUM_FILES) {
    const full = path.join(outDir, rel);
    if (!fs.existsSync(full)) {
      console.warn(`omitido (no existe): ${full}`);
      continue;
    }
    checksums[rel] = sha256Base64(full);
  }
  if (Object.keys(checksums).length === 0) {
    throw new Error(`Sin archivos para checksum en ${outDir}`);
  }
  product.checksums = checksums;
  fs.writeFileSync(productPath, JSON.stringify(product, null, '\t') + '\n', 'utf8');
  console.log(`checksums actualizados: ${productPath}`);
  return true;
}

function main() {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const targets = [
    {
      product: path.join(root, 'VSCode-win32-x64', 'resources', 'app', 'product.json'),
      out: path.join(root, 'VSCode-win32-x64', 'resources', 'app', 'out'),
    },
    {
      product: path.join(root, 'editcore-src', 'product.json'),
      out: path.join(root, 'editcore-src', 'out'),
    },
  ];
  let n = 0;
  for (const t of targets) {
    if (updateProduct(t.product, t.out)) n++;
  }
  if (!n) {
    console.error('No se actualizo ningun product.json');
    process.exit(1);
  }
}

main();
