/**
 * Dev-server debug bridge for native live-reload sessions. Active only when the
 * session launcher (scripts/flavor/live_debug.py) exports the session log/state
 * paths: page console output, uncaught errors and Vite's own logger lines are
 * appended to the shared session log, and loopback-only HTTP routes expose it
 * incrementally for AI tooling.
 */
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, PluginOption, ViteDevServer } from 'vite';

const ENV_DEBUG_LOG = 'CORE_DEBUG_LOG';
const ENV_DEBUG_STATE = 'CORE_DEBUG_STATE';
const ENV_DEBUG_ROUTE = 'CORE_DEBUG_ROUTE';
const LOG_EVENT = 'core-debug:log';
const BRIDGE_ID = 'virtual:core-debug-bridge';
const RESOLVED_BRIDGE_ID = '\0' + BRIDGE_ID;
const BRIDGE_SRC = '/@id/__x00__' + BRIDGE_ID;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5_000;
const MAX_READ_BYTES = 4 * 1024 * 1024;
const TAIL_READ_BYTES = 512 * 1024;
const MAX_TEXT_LENGTH = 8_000;
const LEVELS = ['V', 'D', 'I', 'W', 'E', 'F'];
const LEVEL_PATTERN = / ([VDIWEF]) \S/;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

interface ClientLogEntry {
  level?: string;
  source?: string;
  text?: string;
  href?: string;
}

const BRIDGE_CODE = `
const MAX = ${MAX_TEXT_LENGTH};
const source = /\\bwv\\b/.test(navigator.userAgent) ? 'webview' : 'browser';
const format = (value) => {
  if (value instanceof Error) return value.stack || String(value);
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};
// Vite reports a send before its socket connects through console.error, which is patched below:
// without this guard every console line recursed until the stack overflowed (thousands of native log lines).
let sending = false;
const send = (level, values) => {
  if (sending) return;
  sending = true;
  try {
    import.meta.hot?.send(${JSON.stringify(LOG_EVENT)}, {
      level, source, href: location.href, text: values.map(format).join(' ').slice(0, MAX),
    });
  } catch {} finally {
    sending = false;
  }
};
for (const [method, level] of [['debug', 'D'], ['log', 'I'], ['info', 'I'], ['warn', 'W'], ['error', 'E']]) {
  const original = console[method].bind(console);
  console[method] = (...values) => { original(...values); send(level, values); };
}
addEventListener('error', (event) => send('E', [event.error || event.message, event.filename + ':' + event.lineno]));
addEventListener('unhandledrejection', (event) => send('E', ['Unhandled rejection:', event.reason]));
`;

function timestamp(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:`
    + `${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

function appendLine(logFile: string, origin: string, level: string, tag: string, text: string): void {
  const safeLevel = LEVELS.includes(level) ? level : 'I';
  const body = text.split(/\r?\n/).map((line) => `${origin} ${timestamp()}     0     0 ${safeLevel} ${tag}: ${line}`);
  fs.appendFile(logFile, body.join('\n') + '\n', () => undefined);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readRange(logFile: string, start: number, end: number): string {
  if (end <= start) return '';
  const handle = fs.openSync(logFile, 'r');
  try {
    const buffer = Buffer.alloc(end - start);
    fs.readSync(handle, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(handle);
  }
}

function logsResponse(logFile: string, query: URLSearchParams): Record<string, unknown> {
  const size = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  const limit = Math.min(Math.max(Number(query.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const minLevel = LEVELS.indexOf(String(query.get('level') || 'V').toUpperCase());
  const grep = String(query.get('grep') || '').toLowerCase();
  const requested = query.has('since') ? Number(query.get('since')) : -1;
  const rotated = requested > size;
  const start = requested >= 0 && !rotated ? requested : Math.max(0, size - TAIL_READ_BYTES);
  const end = Math.min(size, start + MAX_READ_BYTES);
  const raw = readRange(logFile, start, end);
  const incremental = requested >= 0 && !rotated;
  const rawLines = raw.slice(0, raw.lastIndexOf('\n') + 1).split('\n');
  rawLines.pop();
  if (!incremental && start > 0) rawLines.shift();
  const matches = (line: string) => {
    const match = LEVEL_PATTERN.exec(line);
    const levelOk = !match || LEVELS.indexOf(match[1]) >= Math.max(minLevel, 0);
    return levelOk && (!grep || line.toLowerCase().includes(grep));
  };
  let next = start + Buffer.byteLength(raw.slice(0, raw.lastIndexOf('\n') + 1), 'utf8');
  let lines: string[] = [];
  if (incremental) {
    let consumed = start;
    for (const line of rawLines) {
      if (lines.length >= limit) break;
      consumed += Buffer.byteLength(line, 'utf8') + 1;
      if (matches(line)) lines.push(line);
    }
    next = consumed;
  } else {
    lines = rawLines.filter(matches).slice(-limit);
  }
  return { file: logFile, size, since: start, next, rotated, more: next < size, lines };
}

function isLoopback(req: IncomingMessage): boolean {
  return LOOPBACK_ADDRESSES.has(String(req.socket.remoteAddress || ''));
}

function wrapLogger(server: ViteDevServer, logFile: string): void {
  const logger = server.config.logger;
  const levels: Array<['info' | 'warn' | 'error', string]> = [['info', 'I'], ['warn', 'W'], ['error', 'E']];
  for (const [method, level] of levels) {
    const original = logger[method].bind(logger);
    logger[method] = (message, options) => {
      original(message, options);
      appendLine(logFile, 'vite', level, 'Vite', String(message));
    };
  }
}

export function nativeDebugBridge(): PluginOption {
  const logFile = process.env[ENV_DEBUG_LOG];
  const stateFile = process.env[ENV_DEBUG_STATE];
  const route = process.env[ENV_DEBUG_ROUTE];
  if (!logFile || !stateFile || !route) return null;

  const plugin: Plugin = {
    name: 'core-native-debug-bridge',
    apply: 'serve',
    resolveId(id) {
      return id === BRIDGE_ID ? RESOLVED_BRIDGE_ID : null;
    },
    load(id) {
      return id === RESOLVED_BRIDGE_ID ? BRIDGE_CODE : null;
    },
    transformIndexHtml() {
      return [{ tag: 'script', attrs: { type: 'module', src: BRIDGE_SRC }, injectTo: 'head-prepend' }];
    },
    configureServer(server) {
      wrapLogger(server, logFile);
      server.ws.on(LOG_EVENT, (entry: ClientLogEntry) => {
        const tag = entry.source === 'browser' ? 'Browser/Console' : 'WebView/Console';
        appendLine(logFile, String(entry.source || 'webview'), String(entry.level || 'I'), tag, String(entry.text || ''));
      });
      server.middlewares.use(route, (req, res) => {
        if (!isLoopback(req)) {
          sendJson(res, 403, { success: false, error: 'loopback_only' });
          return;
        }
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/logs') {
          sendJson(res, 200, logsResponse(logFile, url.searchParams));
          return;
        }
        if (url.pathname === '/session') {
          const session = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8') || '{}') : {};
          sendJson(res, 200, { ...session, log_file: logFile, logs: `${route}/logs`, state_file: stateFile });
          return;
        }
        sendJson(res, 404, { success: false, error: 'unknown_debug_route', routes: [`${route}/logs`, `${route}/session`] });
      });
    },
  };
  return plugin;
}
