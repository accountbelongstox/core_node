#!/usr/bin/env node
/**
 * Local Markdown/Mermaid preview server. All file selection and actions are in the web UI.
 * - No args: start server, open browser at root; user picks file from list/filter/path in the page.
 * - File path or fragment arg: optional shortcut — open browser with that file pre-loaded (still use UI for everything else).
 * Installs dependencies in this directory if missing.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from './server.js';
import { findFirstByFragment } from './scanner.js';
import { ensureDeps } from './ensure-deps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSIONS = ['.md', '.mmd'];
const DEFAULT_PORT = 3751;

const SKIP_DIRS = new Set([
  'node_modules', '__pycache__', '.git', 'build', 'dist', '.dart_tool', '.vite',
  '.next', '.nuxt', 'venv', '.venv', 'target', '.idea', '.vs', 'coverage', '.cache',
  'tmp', 'temp', '.tmp', '.temp', 'out', '.output', '.turbo', '.svelte-kit', '.astro',
  '.gradle', '.pub', '.yarn', '.pnp.cache.js', '.pnp.loader.mjs', '.esbuild', '.parcel-cache',
  '.rollup.cache', '.rpt2_cache', '.rts2_cache_cjs', '.rts2_cache_es', '.flutter-plugins',
  '.pub-cache', '.serverless', '.fusebox', '.dynamodb', '.tern-port', '.node_repl_history',
  '.npm', '.vercel', '.netlify', 'android', 'ios', 'Pods', '.symlinks', '.yarn-integrity', '.node',
]);

function getProjectRoot() {
  const cwd = process.cwd();
  const rootMarkers = ['pyapps', 'scripts', 'poly_apps', 'pycore'];
  function hasMarkers(dir) {
    try {
      const names = fs.readdirSync(dir);
      return rootMarkers.some((m) => names.includes(m));
    } catch {
      return false;
    }
  }
  let cur = cwd && fs.existsSync(cwd) ? path.resolve(cwd) : path.resolve(__dirname, '..', '..', '..');
  while (cur && cur !== path.dirname(cur)) {
    if (hasMarkers(cur)) {
      if (path.basename(cur) === 'scripts') return path.dirname(cur);
      return cur;
    }
    cur = path.dirname(cur);
  }
  cur = process.cwd() || path.resolve(__dirname, '..', '..', '..');
  if (path.basename(cur) === 'scripts') return path.dirname(cur);
  return cur;
}

function parseArg(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

function resolveFilePath(root, arg) {
  const norm = path.normalize(arg);
  if (path.isAbsolute(norm) && fs.existsSync(norm)) return norm;
  const fromRoot = path.join(root, norm);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return null;
}

async function run() {
  const root = getProjectRoot();
  const arg = parseArg(process.argv[2]);

  await ensureDeps(__dirname);

  let initialPath = null;
  if (arg) {
    const asPath = resolveFilePath(root, arg);
    if (asPath) {
      initialPath = path.relative(root, asPath).split(path.sep).join('/');
    } else {
      const found = findFirstByFragment(root, arg, EXTENSIONS, SKIP_DIRS);
      if (found) initialPath = path.relative(root, found).split(path.sep).join('/');
    }
  }

  const port = Number(process.env.MD_PREVIEW_PORT) || DEFAULT_PORT;
  const { server, setWatchedPath } = await createServer(root, __dirname);
  setWatchedPath(null);

  async function requestOldExit() {
    try {
      await fetch(`http://127.0.0.1:${port}/api/exit`, { signal: AbortSignal.timeout(2000) });
    } catch {
      // no previous instance or already gone
    }
  }

  function tryListen(retries = 4) {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        requestOldExit().then(() => {
          setTimeout(() => tryListen(retries - 1), 800);
        });
      } else {
        throw err;
      }
    });
    server.listen(port, '127.0.0.1', () => {
      server.removeAllListeners('error');
      const url = initialPath
        ? `http://127.0.0.1:${port}/?path=${encodeURIComponent(initialPath)}`
        : `http://127.0.0.1:${port}/`;
      console.log(`Preview: ${url}`);
      openBrowser(url);
    });
  }

  await requestOldExit();
  await new Promise((r) => setTimeout(r, 400));
  tryListen();
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
  } else {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [url], { stdio: 'ignore' }).on('error', () => {});
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
