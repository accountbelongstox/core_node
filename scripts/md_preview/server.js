/**
 * Express server: serves preview HTML, /api/content?path=, /api/list, /api/exit (notify old to quit), and SSE for reload.
 */

import http from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { scanQualifiedFiles } from './scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKIP_DIRS = [
  'node_modules', '__pycache__', '.git', 'build', 'dist', '.dart_tool', '.vite',
  '.next', '.nuxt', 'venv', '.venv', 'target', '.idea', '.vs', 'coverage', '.cache',
  'tmp', 'temp', '.tmp', '.temp', 'out', '.output', '.turbo', '.svelte-kit', '.astro',
  '.gradle', '.pub', '.yarn', '.flutter-plugins', '.pub-cache',
];

const IGNORED_GLOBS = SKIP_DIRS.map((d) => '**/' + d + '/**');

export async function createServer(projectRoot, scriptDir) {
  const app = express();
  const server = http.createServer(app);
  const sseClients = new Set();
  const resolvedRoot = path.resolve(projectRoot);

  function notifyFileChange(relativePath) {
    const data = JSON.stringify({ path: relativePath.replace(/\\/g, '/') });
    sseClients.forEach((res) => {
      try {
        res.write('data: ' + data + '\n\n');
      } catch {}
    });
  }

  const watcher = chokidar.watch(resolvedRoot, {
    ignored: [/(^|[\/\\])\../, ...IGNORED_GLOBS],
    persistent: true,
    ignoreInitial: true,
  });
  watcher.on('add', (p) => {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.md' || ext === '.mmd') notifyFileChange(path.relative(resolvedRoot, p));
  });
  watcher.on('change', (p) => {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.md' || ext === '.mmd') notifyFileChange(path.relative(resolvedRoot, p));
  });
  watcher.on('unlink', (p) => {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.md' || ext === '.mmd') notifyFileChange(path.relative(resolvedRoot, p));
  });

  function setWatchedPath() {}

  app.get('/api/content', (req, res) => {
    const rel = req.query.path;
    if (!rel || typeof rel !== 'string') {
      res.status(400).send('Missing path');
      return;
    }
    const full = path.resolve(projectRoot, path.normalize(rel));
    if (!full.startsWith(path.resolve(projectRoot))) {
      res.status(403).send('Forbidden');
      return;
    }
    fs.readFile(full, 'utf8', (err, data) => {
      if (err) {
        res.status(404).send(err.message);
        return;
      }
      res.type('text/plain').send(data);
    });
  });

  app.get('/api/watch', (req, res) => {
    res.writeHead(200).end();
  });

  app.get('/api/root', (req, res) => {
    res.json({ root: projectRoot });
  });

  app.get('/api/list', (req, res) => {
    const ext = ['.md', '.mmd'];
    const skip = new Set(SKIP_DIRS);
    const files = scanQualifiedFiles(projectRoot, ext, skip);
    const rel = files.map((f) => path.relative(projectRoot, f));
    res.json(rel);
  });

  app.get('/api/reload', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  app.get('/api/exit', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 50);
  });

  const publicDir = path.join(scriptDir, 'public');
  app.use(express.static(publicDir));

  app.get('/', (req, res) => {
    const index = path.join(publicDir, 'index.html');
    if (fs.existsSync(index)) {
      res.sendFile(index);
    } else {
      res.status(404).send('index.html not found');
    }
  });

  return {
    server,
    setWatchedPath,
  };
}
