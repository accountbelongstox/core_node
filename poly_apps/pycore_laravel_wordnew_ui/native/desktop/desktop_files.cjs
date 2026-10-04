'use strict';
// Real-disk implementation of the @capacitor/filesystem API for the desktop shell.
// Relative paths live under <userData>/app-files/<directory>; a call without a
// directory takes an absolute path (a `file://` URI or `/C:/...` is accepted).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { app, net } = require('electron');

const FILES_FOLDER = 'app-files';
const DIRECTORY_FOLDERS = {
  DOCUMENTS: 'documents',
  DATA: 'data',
  LIBRARY: 'library',
  CACHE: 'cache',
  EXTERNAL: 'external',
  EXTERNAL_STORAGE: 'external-storage',
};
const DEFAULT_DIRECTORY = 'DATA';
const UTF8_ENCODINGS = new Set(['utf8', 'utf-8', 'ascii', 'utf16']);
const FILE_URI_PREFIX = 'file://';
const WINDOWS_DRIVE_PATH = /^\/[A-Za-z]:/;
const PARTIAL_SUFFIX = '.part';

function filesRoot() {
  return path.join(app.getPath('userData'), FILES_FOLDER);
}

function directoryRoot(directory) {
  return path.join(filesRoot(), DIRECTORY_FOLDERS[directory] || DIRECTORY_FOLDERS[DEFAULT_DIRECTORY]);
}

/** An absolute path from a renderer path: `file://` URIs decoded, `/C:/x` made `C:/x` on Windows. */
function absolutePath(value) {
  let target = String(value || '');
  if (target.startsWith(FILE_URI_PREFIX)) target = decodeURIComponent(target.slice(FILE_URI_PREFIX.length));
  if (process.platform === 'win32' && WINDOWS_DRIVE_PATH.test(target)) target = target.slice(1);
  return path.resolve(target);
}

function resolveTarget(target, directory) {
  if (!directory) return absolutePath(target);
  return path.join(directoryRoot(directory), String(target || '').replace(/^[\\/]+/, ''));
}

function uriOf(target) {
  return pathToFileURL(target).href;
}

function isText(encoding) {
  return Boolean(encoding) && UTF8_ENCODINGS.has(String(encoding).toLowerCase());
}

function bytesOf(data, encoding) {
  return isText(encoding) ? Buffer.from(String(data ?? ''), 'utf8') : Buffer.from(String(data ?? ''), 'base64');
}

/** Node errors become the plugin's messages (`does not exist` is what callers test for). */
async function guarded(target, work) {
  try {
    return await work();
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error(`File does not exist: ${target}`);
    if (error && error.code === 'EEXIST') throw new Error(`Directory exists: ${target}`);
    throw error;
  }
}

async function ensureParent(target) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
}

function statResult(target, stat) {
  return {
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    ctime: Math.round(stat.birthtimeMs || stat.ctimeMs),
    mtime: Math.round(stat.mtimeMs),
    uri: uriOf(target),
  };
}

const handlers = {
  async writeFile({ path: target, data, directory, encoding, recursive }) {
    const file = resolveTarget(target, directory);
    if (recursive !== false) await ensureParent(file);
    await guarded(file, () => fsp.writeFile(file, bytesOf(data, encoding)));
    return { uri: uriOf(file) };
  },
  async appendFile({ path: target, data, directory, encoding }) {
    const file = resolveTarget(target, directory);
    await ensureParent(file);
    await guarded(file, () => fsp.appendFile(file, bytesOf(data, encoding)));
  },
  async readFile({ path: target, directory, encoding }) {
    const file = resolveTarget(target, directory);
    const bytes = await guarded(file, () => fsp.readFile(file));
    return { data: isText(encoding) ? bytes.toString('utf8') : bytes.toString('base64') };
  },
  async deleteFile({ path: target, directory }) {
    const file = resolveTarget(target, directory);
    await guarded(file, () => fsp.unlink(file));
  },
  async mkdir({ path: target, directory, recursive }) {
    const folder = resolveTarget(target, directory);
    await guarded(folder, () => fsp.mkdir(folder, { recursive: Boolean(recursive) }));
  },
  async rmdir({ path: target, directory, recursive }) {
    const folder = resolveTarget(target, directory);
    await guarded(folder, () => fsp.rm(folder, { recursive: Boolean(recursive) }));
  },
  async readdir({ path: target, directory }) {
    const folder = resolveTarget(target, directory);
    const entries = await guarded(folder, () => fsp.readdir(folder, { withFileTypes: true }));
    const files = await Promise.all(entries.map(async (entry) => {
      const full = path.join(folder, entry.name);
      const stat = await fsp.stat(full).catch(() => null);
      return { name: entry.name, ...(stat ? statResult(full, stat) : { type: entry.isDirectory() ? 'directory' : 'file', size: 0, ctime: 0, mtime: 0, uri: uriOf(full) }) };
    }));
    return { files };
  },
  async stat({ path: target, directory }) {
    const file = resolveTarget(target, directory);
    return statResult(file, await guarded(file, () => fsp.stat(file)));
  },
  async rename({ from, to, directory, toDirectory }) {
    const source = resolveTarget(from, directory);
    const destination = resolveTarget(to, toDirectory ?? directory);
    await ensureParent(destination);
    await guarded(source, async () => {
      try {
        await fsp.rename(source, destination);
      } catch (error) {
        if (!error || error.code !== 'EXDEV') throw error;
        await fsp.copyFile(source, destination);
        await fsp.unlink(source);
      }
    });
  },
  async copy({ from, to, directory, toDirectory }) {
    const source = resolveTarget(from, directory);
    const destination = resolveTarget(to, toDirectory ?? directory);
    await ensureParent(destination);
    await guarded(source, () => fsp.cp(source, destination, { recursive: true }));
    return { uri: uriOf(destination) };
  },
  async getUri({ path: target, directory }) {
    return { uri: uriOf(resolveTarget(target, directory)) };
  },
  /** Streams the body to disk (a `.part` file renamed when complete); a failed download leaves nothing behind. */
  async downloadFile({ url, path: target, directory }) {
    const file = resolveTarget(target, directory);
    const partial = `${file}${PARTIAL_SUFFIX}`;
    await ensureParent(file);
    const response = await net.fetch(String(url));
    if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
    try {
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
      await fsp.rename(partial, file);
    } catch (error) {
      await fsp.rm(partial, { force: true }).catch(() => undefined);
      throw error;
    }
    return { path: file };
  },
  async checkPermissions() {
    return { publicStorage: 'granted' };
  },
  async requestPermissions() {
    return { publicStorage: 'granted' };
  },
};

module.exports = { filesRoot, directoryRoot, absolutePath, handlers };
