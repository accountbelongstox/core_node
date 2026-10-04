'use strict';
// Desktop (Windows / Linux) shell of a flavor app: serves the web bundle from
// app://localhost, stored files from app-file://localhost and backs the page's
// Capacitor shims with real disk files and the app plugins (preload.cjs).
// Staged by scripts/flavor/build_desktop.py next to desktop.json and web/.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const { app, BrowserWindow, ipcMain, net, protocol, session, shell } = require('electron');
const { absolutePath, handlers: fileHandlers } = require('./desktop_files.cjs');
const { createPlugins } = require('./desktop_plugins.cjs');

const APP_SCHEME = 'app';
const FILE_SCHEME = 'app-file';
const APP_HOST = 'localhost';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const CONFIG_FILE = 'desktop.json';
const WEB_FOLDER = 'web';
const INDEX_FILE = 'index.html';
const LOG_FOLDER = 'logs';
const CONSOLE_LOG_FILE = 'console.log';
const FS_CHANNEL = 'desktop:fs';
const PLUGIN_CHANNEL = 'desktop:plugin';
const SERVER_URL_ENV = 'CORE_NODE_DESKTOP_SERVER_URL';
const DEBUG_PORT_ENV = 'CORE_NODE_DESKTOP_DEBUG_PORT';
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 860;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const CONSOLE_LEVELS = ['verbose', 'info', 'warning', 'error'];
const MIME_TYPES = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg', '.webm': 'audio/webm', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

const appRoot = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(appRoot, CONFIG_FILE), 'utf8'));
const webRoot = path.join(appRoot, WEB_FOLDER);
const serverUrl = process.env[SERVER_URL_ENV] || config.serverUrl || '';
const plugins = createPlugins(config.appId);
let consoleLog = null;

if (process.env[DEBUG_PORT_ENV]) app.commandLine.appendSwitch('remote-debugging-port', process.env[DEBUG_PORT_ENV]);

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: FILE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: true } },
]);

function log(line) {
  const text = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(text);
  consoleLog?.write(text);
}

function mimeOf(file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

/** The bundle file for a request path; unknown routes are the single-page app's index. */
async function serveBundle(request) {
  const relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
  let file = path.join(webRoot, relative);
  if (!file.startsWith(webRoot)) file = path.join(webRoot, INDEX_FILE);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) file = path.join(webRoot, INDEX_FILE);
  return net.fetch(pathToFileURL(file).href);
}

/** A stored file (clips, images) with byte-range support for media seeking. */
async function serveStoredFile(request) {
  const file = absolutePath(decodeURIComponent(new URL(request.url).pathname));
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) return new Response(null, { status: 404 });
  const headers = { 'Content-Type': mimeOf(file), 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const range = RANGE_PATTERN.exec(request.headers.get('range') || '');
  if (!range || stat.size === 0) {
    return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...headers, 'Content-Length': String(stat.size) } });
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
  if (start > end || start >= stat.size) {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${stat.size}` } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
  });
}

/**
 * The page origin (app://localhost) is not a web origin the backends know: a
 * loopback pycore accepts requests without an Origin, so it is dropped for
 * loopback hosts (LAN / tailnet / Laravel requests keep it).
 */
function stripLoopbackOrigin() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    let host = '';
    try { host = new URL(details.url).hostname; } catch { /* not a URL */ }
    const headers = { ...details.requestHeaders };
    if (LOOPBACK_HOSTS.has(host)) {
      delete headers.Origin;
      delete headers.origin;
    }
    callback({ requestHeaders: headers });
  });
}

function registerIpc() {
  ipcMain.handle(FS_CHANNEL, (_event, method, options) => {
    const handler = fileHandlers[method];
    if (!handler) throw new Error(`Unknown filesystem method: ${method}`);
    return handler(options || {});
  });
  ipcMain.handle(PLUGIN_CHANNEL, (event, plugin, method, options) => {
    const handler = plugins[plugin]?.[method];
    if (!handler) throw new Error(`Unknown plugin method: ${plugin}.${method}`);
    return handler(options || {}, event.sender);
  });
}

function openConsoleLog() {
  const folder = path.join(app.getPath('userData'), LOG_FOLDER);
  fs.mkdirSync(folder, { recursive: true });
  consoleLog = fs.createWriteStream(path.join(folder, CONSOLE_LOG_FILE), { flags: 'a' });
  log(`[desktop] ${config.name} ${app.getVersion()} userData=${app.getPath('userData')}`);
}

function createWindow() {
  const icon = path.join(appRoot, config.icon || '');
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: config.name,
    backgroundColor: config.background,
    icon: config.icon && fs.existsSync(icon) ? icon : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // The bundle talks to Laravel / pycore on other origins (and plain-HTTP LAN
      // machines) like the Android WebView does: no browser CORS / mixed-content gate.
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });
  window.webContents.on('console-message', (event, legacyLevel, legacyMessage, legacyLine, legacySource) => {
    const rawLevel = event.level ?? legacyLevel;
    const level = typeof rawLevel === 'number' ? CONSOLE_LEVELS[rawLevel] : rawLevel;
    log(`[console:${level}] ${event.message ?? legacyMessage} (${event.sourceId ?? legacySource}:${event.lineNumber ?? legacyLine})`);
  });
  window.webContents.on('render-process-gone', (_event, details) => log(`[desktop] renderer gone: ${details.reason}`));
  window.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) log(`[desktop] page load: ${details.url}`);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_ORIGIN)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void window.loadURL(serverUrl || `${APP_ORIGIN}/`);
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.whenReady().then(() => {
    openConsoleLog();
    protocol.handle(APP_SCHEME, serveBundle);
    protocol.handle(FILE_SCHEME, serveStoredFile);
    stripLoopbackOrigin();
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
