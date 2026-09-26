#!/usr/bin/env node
// Cross-platform development watcher: builds the shared package once, then runs
// the shared (tsup), native (nodemon) and extension (WXT dev) watchers together.
// Any watcher exit stops the rest so a service manager restarts one clean set.
// --parent-pid <pid> also stops everything when that owner process disappears
// (a stopped Windows logon task does not terminate grandchildren).
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';
const BUN_COMMAND = 'bun';
const PREPARE_ARGS = ['run', 'build:shared'];
// Each package's own dev script, run in its folder (not through bun --filter,
// which does not forward stdin to the package script).
const WATCHERS = [
  { name: 'shared', cwd: resolve(PROJECT_ROOT, 'packages', 'shared') },
  { name: 'native', cwd: resolve(PROJECT_ROOT, 'app', 'native-server') },
  { name: 'extension', cwd: resolve(PROJECT_ROOT, 'app', 'chrome-extension') },
];
const STOP_SIGNALS = IS_WINDOWS ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
const PARENT_PID_FLAG = '--parent-pid';
const PARENT_POLL_MS = 3000;
const PARENT_PID = Number(process.argv[process.argv.indexOf(PARENT_PID_FLAG) + 1]) || 0;
const children = [];
let stopping = false;

function killTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (IS_WINDOWS) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  children.forEach(killTree);
  process.exit(exitCode);
}

// Watchers get a stdin pipe this process holds open: Vite (WXT dev) exits when
// stdin ends, and a service or background launch has stdin at EOF. The pipe
// closes with this process, so orphaned watchers stop too.
function startWatcher(watcher) {
  const child = spawn(BUN_COMMAND, ['run', 'dev'], {
    cwd: watcher.cwd,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: IS_WINDOWS,
    detached: !IS_WINDOWS,
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[dev-watch] ${watcher.name} watcher stopped (${signal || code}); stopping all watchers.`);
    stopAll(code || 1);
  });
  children.push(child);
}

const prepare = spawnSync(BUN_COMMAND, PREPARE_ARGS, {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  shell: IS_WINDOWS,
});
if (prepare.status !== 0) {
  console.error('[dev-watch] Shared package build failed; watchers not started.');
  process.exit(prepare.status || 1);
}

function watchParent() {
  setInterval(() => {
    try {
      process.kill(PARENT_PID, 0);
    } catch {
      console.error(`[dev-watch] Owner process ${PARENT_PID} exited; stopping all watchers.`);
      stopAll(0);
    }
  }, PARENT_POLL_MS);
}

STOP_SIGNALS.forEach((signal) => process.on(signal, () => stopAll(0)));
WATCHERS.forEach(startWatcher);
if (PARENT_PID > 0) {
  watchParent();
}
