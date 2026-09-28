/**
 * Run npm install in scriptDir if node_modules is missing or incomplete.
 * Skips if node_modules exists and required deps are present.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REQUIRED_DEPS = ['express', 'chokidar', 'marked', 'mermaid'];

export async function ensureDeps(scriptDir) {
  const nodeModules = path.join(scriptDir, 'node_modules');
  const pkgPath = path.join(scriptDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const needInstall = !fs.existsSync(nodeModules) || REQUIRED_DEPS.some((d) => !fs.existsSync(path.join(nodeModules, d)));
  if (!needInstall) return;
  console.log('Installing dependencies in md_preview...');
  const r = spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
    cwd: scriptDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    throw new Error('npm install failed');
  }
  spawnSync('node', ['copy-vendor.js'], { cwd: scriptDir, stdio: 'ignore' });
}
