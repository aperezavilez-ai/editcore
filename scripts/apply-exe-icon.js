#!/usr/bin/env node
/** Aplica code.ico a EditCore.exe copiando a temp (rcedit falla in-place en PE grandes). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXE = path.join(ROOT, 'VSCode-win32-x64', 'EditCore.exe');
const ICO = path.join(ROOT, 'branding', 'icons', 'win32', 'code.ico');
const RCEDIT = path.join(ROOT, 'editcore-src', 'node_modules', 'rcedit', 'bin', 'rcedit.exe');

function findSigntool() {
  const kits = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  if (!fs.existsSync(kits)) return null;
  const versions = fs.readdirSync(kits).filter((v) => /^\d/.test(v)).sort().reverse();
  for (const ver of versions) {
    for (const arch of ['x64', 'x86']) {
      const tool = path.join(kits, ver, arch, 'signtool.exe');
      if (fs.existsSync(tool)) return tool;
    }
  }
  return null;
}

function stripSignature(exe) {
  const signtool = findSigntool();
  if (!signtool) return;
  spawnSync(signtool, ['remove', '/s', exe], { encoding: 'utf8' });
}

function isEditCoreRunning() {
  const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq EditCore.exe', '/NH'], { encoding: 'utf8' });
  return r.stdout && r.stdout.toLowerCase().includes('editcore.exe');
}

function main() {
  if (!fs.existsSync(EXE)) {
    console.error('No existe', EXE);
    process.exit(1);
  }
  if (!fs.existsSync(ICO)) {
    console.error('No existe', ICO, '- corre: node scripts/generate-win32-ico.js');
    process.exit(1);
  }
  if (!fs.existsSync(RCEDIT)) {
    console.error('No existe rcedit');
    process.exit(1);
  }
  if (isEditCoreRunning()) {
    console.error('Cierra EditCore.exe antes de aplicar el icono.');
    process.exit(1);
  }

  const tmp = path.join(os.tmpdir(), `EditCore-icon-${Date.now()}.exe`);
  fs.copyFileSync(EXE, tmp);
  stripSignature(tmp);

  const r = spawnSync(RCEDIT, [tmp, '--set-icon', ICO], { encoding: 'utf8' });
  if (r.status !== 0) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    console.error('rcedit fallo:', (r.stderr || r.stdout || '').trim());
    process.exit(1);
  }

  const backup = EXE + '.iconbak';
  try {
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(EXE, backup);
    fs.copyFileSync(tmp, EXE);
    fs.unlinkSync(backup);
    fs.unlinkSync(tmp);
  } catch (err) {
    console.error('No se pudo reemplazar el exe:', err.message);
    process.exit(1);
  }

  console.log(`Icono aplicado a ${EXE}`);

  const installer = path.join(ROOT, 'EditCoreUserSetup-x64.exe');
  if (fs.existsSync(installer) && fs.existsSync(ICO)) {
    const tmpIns = path.join(os.tmpdir(), `EditCoreSetup-icon-${Date.now()}.exe`);
    fs.copyFileSync(installer, tmpIns);
    stripSignature(tmpIns);
    const ri = spawnSync(RCEDIT, [tmpIns, '--set-icon', ICO], { encoding: 'utf8' });
    if (ri.status === 0) {
      const bak = installer + '.iconbak';
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
      fs.renameSync(installer, bak);
      fs.copyFileSync(tmpIns, installer);
      fs.unlinkSync(bak);
      fs.unlinkSync(tmpIns);
      console.log(`Icono aplicado a ${installer}`);
    }
  }
}

main();
