#!/usr/bin/env node
/**
 * Sincroniza VERSION con package.json de extensiones, branding y manifiestos de release.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'VERSION');

function readVersion() {
  const raw = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(raw)) {
    throw new Error(`VERSION inválida: ${raw}`);
  }
  return raw;
}

function writeJson(filePath, mutate) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  mutate(data);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('OK:', path.relative(ROOT, filePath));
}

function main() {
  const version = process.argv[2]?.trim() || readVersion();
  const [major, minor, patch] = version.split(/[.-]/).map((x) => parseInt(x, 10));
  const productVersion = `${major}.${minor}.${patch}`;

  for (const ext of ['editcore-claude', 'editcore-connect']) {
    writeJson(path.join(ROOT, 'extensions', ext, 'package.json'), (pkg) => {
      pkg.version = version;
    });
  }

  const brandingPath = path.join(ROOT, 'branding', 'product.json');
  if (fs.existsSync(brandingPath)) {
    writeJson(brandingPath, (product) => {
      product.editCoreProductVersion = version;
      product.version = productVersion;
    });
  }

  const latestPath = path.join(ROOT, 'releases', 'latest.json');
  if (fs.existsSync(latestPath)) {
    writeJson(latestPath, (latest) => {
      latest.version = version;
      latest.productVersion = productVersion;
    });
  }

  const stablePath = path.join(ROOT, 'releases', 'update', 'win32-x64', 'stable.json');
  if (fs.existsSync(stablePath)) {
    writeJson(stablePath, (stable) => {
      stable.version = version;
      stable.productVersion = productVersion;
    });
  }

  if (!process.argv[2]) {
    fs.writeFileSync(VERSION_FILE, version + '\n', 'utf8');
  }

  console.log(`Versión sincronizada: ${version}`);
}

main();
