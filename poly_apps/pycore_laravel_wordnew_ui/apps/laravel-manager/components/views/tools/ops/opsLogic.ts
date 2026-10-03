/** Pure helpers of the ops workbenches: formatting, gauges, prompt templating, mapping rules, polling. */

export type LoadTone = 'ok' | 'warn' | 'crit';

export interface MemoryUsage {
  total: number;
  used: number;
  available: number;
  percent: number;
}

export interface MountRow {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  use_percent: string;
  mounted_on: string;
}

export interface ReplaceEntry {
  from: string;
  to: string;
}

export interface PromptMapping {
  prefix: string;
  suffix: string;
  replace_map: Record<string, string>;
}

export interface PollOutcome<T> {
  value: T | null;
  done: boolean;
  cancelled: boolean;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const BYTE_STEP = 1024;
const WARN_PERCENT = 70;
const CRIT_PERCENT = 90;
const CERT_CRIT_DAYS = 7;
const CERT_WARN_DAYS = 30;
const CERT_WINDOW_DAYS = 90;
const VARIABLE_PATTERN = /\{([A-Za-z_][\w-]*)\}/g;
const PSEUDO_FILESYSTEMS = new Set(['tmpfs', 'devtmpfs', 'udev', 'squashfs', 'shm', 'none']);
const PSEUDO_MOUNT_PREFIXES = ['/sys', '/proc', '/dev', '/run'];
const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU',
  pt: 'pt-PT', it: 'it-IT', ar: 'ar-SA', hi: 'hi-IN', tr: 'tr-TR', vi: 'vi-VN', th: 'th-TH', id: 'id-ID',
  nl: 'nl-NL', pl: 'pl-PL', uk: 'uk-UA', yue: 'zh-HK',
};
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};
const VOICE_AUDIO_ROUTE = '/api/mcp/v1/voice-subtitle/audio/';

export const clampPercent = (value: number): number => (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);

export const formatBytes = (bytes: number | null | undefined, digits = 1): string => {
  let value = Number.isFinite(bytes) ? Math.max(0, bytes as number) : 0;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
};

export const formatSeconds = (seconds: number | null | undefined): string => {
  const value = Number.isFinite(seconds) ? (seconds as number) : 0;
  return value < 10 ? `${value.toFixed(2)}s` : `${value.toFixed(1)}s`;
};

export const formatTimestamp = (millis: number | null | undefined, locale?: string): string =>
  millis ? new Date(millis).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';

export const percentTone = (percent: number): LoadTone => (percent >= CRIT_PERCENT ? 'crit' : percent >= WARN_PERCENT ? 'warn' : 'ok');

export const loadPercent = (load: number | null | undefined, cores: number | null | undefined): number =>
  cores && cores > 0 && Number.isFinite(load) ? clampPercent(((load as number) / cores) * 100) : 0;

export const memoryUsage = (memory: { total?: number; free?: number; available?: number } | null | undefined): MemoryUsage => {
  const total = memory?.total ?? 0;
  const available = memory?.available ?? memory?.free ?? 0;
  const used = Math.max(0, total - available);
  return { total, used, available, percent: total > 0 ? clampPercent((used / total) * 100) : 0 };
};

/** The "up ..." part of a raw `uptime` line; null when it cannot be read. */
export const parseUptime = (raw: string | null | undefined): string | null => {
  const text = (raw ?? '').replace(/\s+/g, ' ');
  const match = text.match(/\bup (.+?), \d+ users?/i) ?? text.match(/\bup ([^,]+(?:, [^,]+)?)/i);
  return match ? match[1].trim() : null;
};

export const parseUsePercent = (value: string | null | undefined): number => clampPercent(parseInt(value ?? '0', 10));

export const realMounts = (rows: MountRow[]): MountRow[] =>
  rows.filter((row) => !PSEUDO_FILESYSTEMS.has(row.filesystem) && !PSEUDO_MOUNT_PREFIXES.some((prefix) => row.mounted_on.startsWith(prefix)));

export const pickRootMount = (rows: MountRow[]): MountRow | null => {
  const mounts = realMounts(rows);
  return mounts.find((row) => row.mounted_on === '/')
    ?? mounts.reduce<MountRow | null>((best, row) => (!best || parseUsePercent(row.use_percent) > parseUsePercent(best.use_percent) ? row : best), null);
};

export const certTone = (daysLeft: number): LoadTone => (daysLeft <= CERT_CRIT_DAYS ? 'crit' : daysLeft <= CERT_WARN_DAYS ? 'warn' : 'ok');

export const certWindowPercent = (daysLeft: number, windowDays = CERT_WINDOW_DAYS): number => clampPercent((daysLeft / windowDays) * 100);

export const basename = (path: string): string => path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;

export const parentPath = (path: string): string => {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
};

export const mimeExtension = (mime: string | null | undefined): string => MIME_EXTENSIONS[mime ?? ''] ?? (mime?.split('/')[1] ?? 'bin');

export const speechLocale = (code: string): string => (code.includes('-') ? code : SPEECH_LOCALES[code] ?? code);

export const audioUrlForVoiceFile = (filePath: string): string => `${VOICE_AUDIO_ROUTE}${encodeURIComponent(basename(filePath))}`;

export const pageCount = (total: number, size: number): number => Math.max(1, Math.ceil(total / Math.max(1, size)));

export const pageSlice = <T,>(items: readonly T[], page: number, size: number): T[] => items.slice((page - 1) * size, page * size);

/** Distinct `{name}` placeholders of a prompt template, in first-use order. */
export const extractVariables = (content: string): string[] => {
  const names: string[] = [];
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
};

/** Fills the `{name}` placeholders that have a value; empty ones stay visible. */
export const renderPrompt = (content: string, values: Record<string, string>): string =>
  content.replace(VARIABLE_PATTERN, (placeholder, name: string) => (values[name] ? values[name] : placeholder));

/** The server's mapping order: replace rules, then prefix, then suffix. */
export const applyPromptMapping = (mapping: PromptMapping, content: string): string => {
  let result = content;
  Object.entries(mapping.replace_map).forEach(([search, replacement]) => {
    if (search !== '') result = result.split(search).join(replacement);
  });
  return `${mapping.prefix}${result}${mapping.suffix}`;
};

/** PHP serializes an empty map as `[]` and a filled one as an object. */
export const replaceEntries = (raw: unknown): ReplaceEntry[] =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.entries(raw as Record<string, unknown>).map(([from, to]) => ({ from, to: String(to ?? '') }))
    : [];

export const replaceMapFromEntries = (entries: readonly ReplaceEntry[]): Record<string, string> =>
  entries.reduce<Record<string, string>>((map, entry) => (entry.from === '' ? map : { ...map, [entry.from]: entry.to }), {});

export const normalizeMapping = (raw: unknown): PromptMapping => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    prefix: typeof source.prefix === 'string' ? source.prefix : '',
    suffix: typeof source.suffix === 'string' ? source.suffix : '',
    replace_map: replaceMapFromEntries(replaceEntries(source.replace_map)),
  };
};

export const sameMapping = (a: PromptMapping, b: PromptMapping): boolean =>
  a.prefix === b.prefix && a.suffix === b.suffix && JSON.stringify(Object.entries(a.replace_map)) === JSON.stringify(Object.entries(b.replace_map));

/** One readable translation out of the dictionary's simple-translation payload (string or language map). */
export const pickTranslation = (raw: unknown, preferred: readonly string[]): string => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(String).join('; ');
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const key = preferred.find((code) => typeof map[code] === 'string' && map[code] !== '') ?? Object.keys(map).find((code) => typeof map[code] === 'string' && map[code] !== '');
    return key ? String(map[key]) : '';
  }
  return '';
};

/** Saves a blob through a temporary anchor (works for generated files and fetched media). */
export const saveBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Downloads a remote file as a blob; falls back to opening it when the fetch is blocked. */
export const downloadUrl = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    saveBlob(await response.blob(), filename);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Repeats `step` until `done` accepts its value, the attempts run out, or the caller cancels. */
export async function pollUntil<T>(
  step: (attempt: number) => Promise<T>,
  done: (value: T) => boolean,
  options: { intervalMs: number; maxAttempts: number; isCancelled: () => boolean; onTick?: (value: T, attempt: number) => void },
): Promise<PollOutcome<T>> {
  let value: T | null = null;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.isCancelled()) return { value, done: false, cancelled: true };
    value = await step(attempt);
    if (options.isCancelled()) return { value, done: false, cancelled: true };
    options.onTick?.(value, attempt);
    if (done(value)) return { value, done: true, cancelled: false };
    if (attempt < options.maxAttempts) await delay(options.intervalMs);
  }
  return { value, done: false, cancelled: false };
}
