#!/usr/bin/env node
/**
 * Genera releases/latest.json y releases/update/win32-x64/stable.json desde dist/.
 * Uso: node scripts/generate-release-manifest.js [version]
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const REPO = 'aperezavilez-ai/editcore';

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function readVersion() {
  if (process.argv[2]) return process.argv[2].replace(/^v/, '');
  return fs.readFileSync(VERSION_FILE, 'utf8').trim();
}

function main() {
  const version = readVersion();
  const tag = `v${version}`;
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;
  const portableName = `EditCore-${version}-win32-x64-portable.zip`;
  const setupName = `EditCore-${version}-win32-x64-setup.exe`;

  const portableFile = fs.existsSync(path.join(DIST, portableName))
    ? path.join(DIST, portableName)
    : undefined;

  const setupFile = fs.existsSync(path.join(DIST, setupName))
    ? path.join(DIST, setupName)
    : fs.existsSync(path.join(ROOT, 'EditCoreUserSetup-x64.exe'))
      ? path.join(ROOT, 'EditCoreUserSetup-x64.exe')
      : undefined;

  const latest = {
    version,
    productVersion: version.split('-')[0],
    publishedAt: new Date().toISOString(),
    notes: `EditCore IDE ${version}`,
    portable: portableFile
      ? {
          name: path.basename(portableFile),
          url: `${baseUrl}/${path.basename(portableFile)}`,
          sha256: sha256File(portableFile),
        }
      : undefined,
    setup: setupFile
      ? {
          name: setupName,
          url: `${baseUrl}/${setupName}`,
          sha256: sha256File(setupFile),
        }
      : undefined,
  };

  const stable = {
    version,
    productVersion: version.split('-')[0],
    timestamp: Date.now(),
    url: latest.setup?.url ?? latest.portable?.url ?? `${baseUrl}`,
    name: version,
    sha256hash: latest.setup?.sha256 ?? latest.portable?.sha256 ?? '',
  };

  fs.mkdirSync(path.join(ROOT, 'releases', 'update', 'win32-x64'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'releases', 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
  fs.writeFileSync(
    path.join(ROOT, 'releases', 'update', 'win32-x64', 'stable.json'),
    JSON.stringify(stable, null, 2) + '\n'
  );

  console.log('Manifiestos generados:');
  console.log(' - releases/latest.json');
  console.log(' - releases/update/win32-x64/stable.json');
  if (latest.portable) console.log(`   portable sha256: ${latest.portable.sha256.slice(0, 16)}…`);
  if (latest.setup) console.log(`   setup sha256: ${latest.setup.sha256.slice(0, 16)}…`);
}

main();
