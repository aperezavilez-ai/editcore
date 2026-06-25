#!/usr/bin/env node
/** Wrapper: delega a generate-win32-ico.py (ICO BMP sin PNG). */
const { execFileSync } = require('child_process');
const path = require('path');
execFileSync('python', [path.join(__dirname, 'generate-win32-ico.py')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});
