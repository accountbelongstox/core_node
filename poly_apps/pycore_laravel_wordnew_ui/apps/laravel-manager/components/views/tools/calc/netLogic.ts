/** Pure network helpers: IPv4/IPv6, MAC, user agent, chmod and port generation. */

export const IPV4_MAX = 0xffffffff;
export const IPV4_SPACE = 2 ** 32;

const OCTET_PATTERN = /^\d{1,3}$/;
const HEX_PATTERN = /^[0-9a-f]+$/i;
const IPV4_CLASSES: ReadonlyArray<{ klass: 'A' | 'B' | 'C' | 'D' | 'E'; below: number }> = [
  { klass: 'A', below: 128 }, { klass: 'B', below: 192 }, { klass: 'C', below: 224 }, { klass: 'D', below: 240 }, { klass: 'E', below: 256 },
];

const u32 = (n: number): number => n >>> 0;

export const prefixToMask = (prefix: number): number => (prefix <= 0 ? 0 : u32(IPV4_MAX << (32 - prefix)));

export function parseIpv4(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4 || !parts.every((p) => OCTET_PATTERN.test(p) && Number(p) <= 255)) return null;
  return u32(parts.reduce((acc, p) => acc * 256 + Number(p), 0));
}

export const formatIpv4 = (n: number): string => [24, 16, 8, 0].map((shift) => (u32(n) >>> shift) & 255).join('.');

export function maskToPrefix(mask: number): number | null {
  const inverted = u32(~mask);
  if ((inverted & u32(inverted + 1)) !== 0) return null;
  return 32 - Math.log2(inverted + 1);
}

export interface SubnetInput { ip: number; prefix: number | null }

/** Accepts `ip`, `ip/prefix` or `ip/netmask`. */
export function parseSubnetInput(text: string): SubnetInput | null {
  const [ipText, suffix] = text.trim().split('/');
  const ip = parseIpv4(ipText ?? '');
  if (ip === null) return null;
  if (suffix === undefined) return { ip, prefix: null };
  if (/^\d{1,2}$/.test(suffix)) return Number(suffix) <= 32 ? { ip, prefix: Number(suffix) } : null;
  const mask = parseIpv4(suffix);
  const prefix = mask === null ? null : maskToPrefix(mask);
  return prefix === null ? null : { ip, prefix };
}

export type AddressKind =
  | 'this_network' | 'private' | 'shared' | 'loopback' | 'link_local' | 'protocol' | 'documentation'
  | 'relay' | 'benchmark' | 'multicast' | 'reserved' | 'broadcast' | 'public';

const KIND_BLOCKS: ReadonlyArray<{ base: string; prefix: number; kind: AddressKind }> = [
  { base: '0.0.0.0', prefix: 8, kind: 'this_network' }, { base: '10.0.0.0', prefix: 8, kind: 'private' },
  { base: '100.64.0.0', prefix: 10, kind: 'shared' }, { base: '127.0.0.0', prefix: 8, kind: 'loopback' },
  { base: '169.254.0.0', prefix: 16, kind: 'link_local' }, { base: '172.16.0.0', prefix: 12, kind: 'private' },
  { base: '192.0.0.0', prefix: 24, kind: 'protocol' }, { base: '192.0.2.0', prefix: 24, kind: 'documentation' },
  { base: '192.88.99.0', prefix: 24, kind: 'relay' }, { base: '192.168.0.0', prefix: 16, kind: 'private' },
  { base: '198.18.0.0', prefix: 15, kind: 'benchmark' }, { base: '198.51.100.0', prefix: 24, kind: 'documentation' },
  { base: '203.0.113.0', prefix: 24, kind: 'documentation' }, { base: '224.0.0.0', prefix: 4, kind: 'multicast' },
  { base: '255.255.255.255', prefix: 32, kind: 'broadcast' }, { base: '240.0.0.0', prefix: 4, kind: 'reserved' },
];

export function classifyIpv4(ip: number): AddressKind {
  for (const block of KIND_BLOCKS) {
    const base = parseIpv4(block.base) as number;
    if (u32(ip & prefixToMask(block.prefix)) === base) return block.kind;
  }
  return 'public';
}

export interface SubnetInfo {
  ip: number; prefix: number; mask: number; wildcard: number; network: number; broadcast: number;
  first: number; last: number; total: number; usable: number; klass: 'A' | 'B' | 'C' | 'D' | 'E'; kind: AddressKind;
}

export function subnetInfo(ip: number, prefix: number): SubnetInfo {
  const mask = prefixToMask(prefix);
  const network = u32(ip & mask);
  const broadcast = u32(network | u32(~mask));
  const total = 2 ** (32 - prefix);
  const pointToPoint = prefix >= 31;
  return {
    ip, prefix, mask, wildcard: u32(~mask), network, broadcast,
    first: pointToPoint ? network : network + 1, last: pointToPoint ? broadcast : broadcast - 1,
    total, usable: prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2,
    klass: IPV4_CLASSES.find((c) => (ip >>> 24) < c.below)?.klass ?? 'E', kind: classifyIpv4(ip),
  };
}

export interface SubnetRow { network: number; broadcast: number; first: number; last: number; usable: number }

export function splitSubnets(network: number, prefix: number, newPrefix: number, limit: number): { rows: SubnetRow[]; count: number } {
  const count = 2 ** (newPrefix - prefix);
  const size = 2 ** (32 - newPrefix);
  const rows: SubnetRow[] = [];
  for (let i = 0; i < Math.min(count, limit); i += 1) {
    const info = subnetInfo(u32(network + i * size), newPrefix);
    rows.push({ network: info.network, broadcast: info.broadcast, first: info.first, last: info.last, usable: info.usable });
  }
  return { rows, count };
}

export const bitsOf = (n: number): string => u32(n).toString(2).padStart(32, '0');

export const ipv4Octets = (n: number): number[] => [24, 16, 8, 0].map((shift) => (u32(n) >>> shift) & 255);

/** Minimal list of CIDR blocks exactly covering start..end. */
export function rangeToCidrs(start: number, end: number): Array<{ network: number; prefix: number }> {
  const out: Array<{ network: number; prefix: number }> = [];
  let cursor = start;
  while (cursor <= end) {
    let size = cursor === 0 ? IPV4_SPACE : cursor & -cursor;
    while (size > end - cursor + 1) size /= 2;
    out.push({ network: cursor, prefix: 32 - Math.log2(size) });
    cursor += size;
  }
  return out;
}

// ---------------------------------------------------------------- ipv4 converter

export type Ipv4Field = 'dotted' | 'decimal' | 'hex' | 'binary' | 'octal';
export const IPV4_FIELDS: readonly Ipv4Field[] = ['dotted', 'decimal', 'hex', 'binary', 'octal'];

export function parseIpv4Field(field: Ipv4Field, text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;
  if (field === 'dotted') return parseIpv4(raw);
  if (field === 'decimal') return /^\d{1,10}$/.test(raw) && Number(raw) <= IPV4_MAX ? Number(raw) : null;
  if (field === 'hex') {
    const digits = raw.replace(/^0x/i, '').replace(/[\s.:]/g, '');
    return HEX_PATTERN.test(digits) && digits.length <= 8 ? parseInt(digits, 16) : null;
  }
  if (field === 'binary') {
    const digits = raw.replace(/^0b/i, '').replace(/[\s.]/g, '');
    return /^[01]{1,32}$/.test(digits) ? parseInt(digits, 2) : null;
  }
  const digits = raw.replace(/^0o/i, '');
  return /^[0-7]{1,11}$/.test(digits) && parseInt(digits, 8) <= IPV4_MAX ? parseInt(digits, 8) : null;
}

export function formatIpv4Field(field: Ipv4Field, n: number): string {
  if (field === 'dotted') return formatIpv4(n);
  if (field === 'decimal') return String(u32(n));
  if (field === 'hex') return `0x${u32(n).toString(16).toUpperCase().padStart(8, '0')}`;
  if (field === 'binary') return ipv4Octets(n).map((o) => o.toString(2).padStart(8, '0')).join('.');
  return `0${u32(n).toString(8)}`;
}

export const ipv4MappedIpv6 = (n: number): string => {
  const hi = (u32(n) >>> 16).toString(16);
  const lo = (u32(n) & 0xffff).toString(16);
  return `::ffff:${hi}:${lo}`;
};

export const ipv4ReverseDns = (n: number): string => `${ipv4Octets(n).reverse().join('.')}.in-addr.arpa`;

// ---------------------------------------------------------------- ipv4 range

export interface IpRange { start: number; end: number }

export type RangeParseError = 'empty' | 'invalid' | 'reversed';

/** Accepts `a-b`, `a-N` (last octet), CIDR, wildcard `10.0.*.*` and a single address. */
export function parseIpRange(text: string): IpRange | RangeParseError {
  const raw = text.trim();
  if (!raw) return 'empty';
  if (raw.includes('/')) {
    const parsed = parseSubnetInput(raw);
    if (!parsed || parsed.prefix === null) return 'invalid';
    const info = subnetInfo(parsed.ip, parsed.prefix);
    return { start: info.network, end: info.broadcast };
  }
  if (raw.includes('*')) {
    const parts = raw.split('.');
    if (parts.length !== 4 || !parts.every((p) => p === '*' || (OCTET_PATTERN.test(p) && Number(p) <= 255))) return 'invalid';
    const start = parseIpv4(parts.map((p) => (p === '*' ? '0' : p)).join('.'));
    const end = parseIpv4(parts.map((p) => (p === '*' ? '255' : p)).join('.'));
    return start === null || end === null ? 'invalid' : { start, end };
  }
  const [left, right] = raw.split(/\s*[-–—~]\s*/);
  const start = parseIpv4(left ?? '');
  if (start === null) return 'invalid';
  if (right === undefined) return { start, end: start };
  let end = parseIpv4(right);
  if (end === null && OCTET_PATTERN.test(right) && Number(right) <= 255) end = u32((start & 0xffffff00) + Number(right));
  if (end === null) return 'invalid';
  return end < start ? 'reversed' : { start, end };
}

// ---------------------------------------------------------------- ipv6 ula

const GLOBAL_ID_BYTES = 5;
const IID_BYTES = 8;

export const randomBytes = (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length));

const hex2 = (b: number): string => b.toString(16).padStart(2, '0');

export function compressIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== 0) { i += 1; continue; }
    let j = i;
    while (j < groups.length && groups[j] === 0) j += 1;
    if (j - i > bestLen) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  const text = groups.map((g) => g.toString(16));
  if (bestLen < 2) return text.join(':');
  const head = text.slice(0, bestStart).join(':');
  const tail = text.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}

export interface UlaPrefix { globalId: string; prefix48: string; subnet64: string; reverseZone: string; groups: number[] }

export function generateUlaPrefix(subnetId: number, globalIdBytes: Uint8Array = randomBytes(GLOBAL_ID_BYTES)): UlaPrefix {
  const bytes = [0xfd, ...Array.from(globalIdBytes)];
  const groups = [(bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3], (bytes[4] << 8) | bytes[5], subnetId & 0xffff];
  const nibbles = bytes.map(hex2).join('').split('').reverse().join('.');
  return {
    globalId: bytes.slice(1).map(hex2).join(''),
    prefix48: `${compressIpv6([...groups.slice(0, 3), 0, 0, 0, 0, 0])}/48`,
    subnet64: `${compressIpv6([...groups, 0, 0, 0, 0])}/64`,
    reverseZone: `${nibbles}.ip6.arpa`,
    groups,
  };
}

export function randomInterfaceId(): number[] {
  const iid = randomBytes(IID_BYTES);
  return [0, 2, 4, 6].map((i) => (iid[i] << 8) | iid[i + 1]);
}

export const composeUlaHost = (groups: number[], interfaceId: number[]): string => compressIpv6([...groups, ...interfaceId]);

export const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes).map(hex2).join('');

export const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16));

export const randomGlobalId = (): string => bytesToHex(randomBytes(GLOBAL_ID_BYTES));

// ---------------------------------------------------------------- mac

export type MacSeparator = ':' | '-' | '.' | '';

export interface MacPreset { key: string; oui: string }

export const MAC_PRESETS: readonly MacPreset[] = [
  { key: 'Raspberry Pi', oui: 'B8:27:EB' },
  { key: 'VMware', oui: '00:50:56' },
  { key: 'VirtualBox', oui: '08:00:27' },
  { key: 'Hyper-V', oui: '00:15:5D' },
  { key: 'QEMU/KVM', oui: '52:54:00' },
  { key: 'Xen', oui: '00:16:3E' },
];

export function parseMac(text: string): number[] | null {
  const digits = text.trim().replace(/[\s:.-]/g, '');
  if (!/^[0-9a-f]{12}$/i.test(digits)) return null;
  return Array.from({ length: 6 }, (_, i) => parseInt(digits.slice(i * 2, i * 2 + 2), 16));
}

export function parseMacPrefix(text: string): number[] | null {
  const digits = text.trim().replace(/[\s:.-]/g, '');
  if (!digits) return [];
  if (!/^(?:[0-9a-f]{2}){1,5}$/i.test(digits)) return null;
  return Array.from({ length: digits.length / 2 }, (_, i) => parseInt(digits.slice(i * 2, i * 2 + 2), 16));
}

export function formatMac(bytes: readonly number[], separator: MacSeparator, upper: boolean): string {
  const hex = bytes.map(hex2);
  const joined = separator === '.' ? Array.from({ length: Math.ceil(hex.length / 2) }, (_, i) => hex.slice(i * 2, i * 2 + 2).join('')).join('.') : hex.join(separator);
  return upper ? joined.toUpperCase() : joined;
}

export interface MacFlags { multicast: boolean; local: boolean }

export const macFlags = (bytes: readonly number[]): MacFlags => ({ multicast: (bytes[0] & 1) === 1, local: (bytes[0] & 2) === 2 });

export interface MacGenOptions { count: number; prefix: number[]; multicast: boolean; local: boolean }

export function generateMacs(options: MacGenOptions): number[][] {
  return Array.from({ length: options.count }, () => {
    const random = randomBytes(6 - options.prefix.length);
    const bytes = [...options.prefix, ...Array.from(random)];
    if (options.prefix.length === 0) {
      bytes[0] = options.multicast ? bytes[0] | 1 : bytes[0] & 0xfe;
      bytes[0] = options.local ? bytes[0] | 2 : bytes[0] & 0xfd;
    }
    return bytes;
  });
}

// ---------------------------------------------------------------- user agent

export interface UaInfo {
  browser: { name: string; version: string };
  engine: { name: string; version: string };
  os: { name: string; version: string };
  device: { type: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'console' | 'bot' | 'unknown'; vendor: string; model: string };
  cpu: string;
  bot: string;
  tokens: Array<{ kind: 'product' | 'comment'; text: string }>;
}

const BROWSER_RULES: ReadonlyArray<[string, RegExp]> = [
  ['Edge', /\b(?:Edg|EdgA|EdgiOS|Edge)\/([\d.]+)/],
  ['Opera', /\b(?:OPR|Opera|OPT)\/([\d.]+)/],
  ['Samsung Internet', /\bSamsungBrowser\/([\d.]+)/],
  ['Vivaldi', /\bVivaldi\/([\d.]+)/],
  ['Yandex Browser', /\bYaBrowser\/([\d.]+)/],
  ['UC Browser', /\bUCBrowser\/([\d.]+)/],
  ['WeChat', /\bMicroMessenger\/([\d.]+)/],
  ['QQ Browser', /\bM?QQBrowser\/([\d.]+)/],
  ['Firefox', /\b(?:Firefox|FxiOS)\/([\d.]+)/],
  ['Electron', /\bElectron\/([\d.]+)/],
  ['Chrome', /\b(?:Chrome|CriOS|HeadlessChrome)\/([\d.]+)/],
  ['Internet Explorer', /\bMSIE ([\d.]+)|\bTrident\/.*rv:([\d.]+)/],
  ['Safari', /\bVersion\/([\d.]+).*Safari\//],
  ['curl', /\bcurl\/([\d.]+)/],
  ['Wget', /\bWget\/([\d.]+)/],
  ['Postman', /\bPostmanRuntime\/([\d.]+)/],
  ['Python Requests', /\bpython-requests\/([\d.]+)/],
];

const BOT_PATTERN = /(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|Applebot|AhrefsBot|SemrushBot|facebookexternalhit|Twitterbot|LinkedInBot|Bytespider|GPTBot|ClaudeBot|CCBot|PetalBot|\b[\w-]*(?:bot|crawler|spider)\b)/i;
const WINDOWS_VERSIONS: Record<string, string> = { '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP', '5.0': '2000' };

const dotted = (v: string): string => v.replace(/_/g, '.');

function detectOs(ua: string): UaInfo['os'] {
  let m: RegExpExecArray | null;
  if ((m = /Windows NT ([\d.]+)/.exec(ua))) return { name: 'Windows', version: WINDOWS_VERSIONS[m[1]] ?? m[1] };
  if ((m = /Windows Phone (?:OS )?([\d.]+)/.exec(ua))) return { name: 'Windows Phone', version: m[1] };
  if ((m = /\b(?:iPhone|CPU) OS ([\d_]+)/.exec(ua)) && /iPhone|iPad|iPod/.test(ua)) return { name: /iPad/.test(ua) ? 'iPadOS' : 'iOS', version: dotted(m[1]) };
  if ((m = /Android ([\d.]+)/.exec(ua))) return { name: 'Android', version: m[1] };
  if (/Android/.test(ua)) return { name: 'Android', version: '' };
  if (/HarmonyOS/.test(ua)) return { name: 'HarmonyOS', version: (/HarmonyOS ([\d.]+)/.exec(ua) ?? [])[1] ?? '' };
  if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) return { name: 'macOS', version: dotted(m[1]) };
  if (/CrOS/.test(ua)) return { name: 'Chrome OS', version: (/CrOS \S+ ([\d.]+)/.exec(ua) ?? [])[1] ?? '' };
  if ((m = /\b(Ubuntu|Debian|Fedora|CentOS|Red Hat|SUSE|Arch|Mint|Kali)\b/i.exec(ua)) && /Linux|X11/.test(ua)) return { name: m[1], version: '' };
  if (/Linux|X11/.test(ua)) return { name: 'Linux', version: '' };
  if (/FreeBSD|OpenBSD|NetBSD/.test(ua)) return { name: (/(FreeBSD|OpenBSD|NetBSD)/.exec(ua) as RegExpExecArray)[1], version: '' };
  if (/Tizen/.test(ua)) return { name: 'Tizen', version: (/Tizen ([\d.]+)/.exec(ua) ?? [])[1] ?? '' };
  if (/Web0S|webOS/.test(ua)) return { name: 'webOS', version: '' };
  return { name: '', version: '' };
}

function detectDevice(ua: string, os: string, bot: string): UaInfo['device'] {
  let m: RegExpExecArray | null;
  if (bot) return { type: 'bot', vendor: '', model: '' };
  if (/PlayStation|Xbox|Nintendo/.test(ua)) return { type: 'console', vendor: (/(PlayStation|Xbox|Nintendo)/.exec(ua) as RegExpExecArray)[1], model: '' };
  if (/SMART-TV|SmartTV|Tizen|Web0S|webOS|AppleTV|HbbTV|CrKey|BRAVIA/i.test(ua)) return { type: 'tv', vendor: '', model: '' };
  if (/iPad/.test(ua)) return { type: 'tablet', vendor: 'Apple', model: 'iPad' };
  if (/iPhone/.test(ua)) return { type: 'mobile', vendor: 'Apple', model: 'iPhone' };
  if (/iPod/.test(ua)) return { type: 'mobile', vendor: 'Apple', model: 'iPod' };
  if (os === 'Android' || os === 'HarmonyOS') {
    const model = (m = /;\s*([^;()]+?)\s+Build\//.exec(ua)) ? m[1] : (m = /Android [\d.]+;\s*([^;)]+)\)/.exec(ua)) ? m[1] : '';
    const vendor = /Pixel/.test(model) ? 'Google' : /^(SM-|GT-)/.test(model) ? 'Samsung' : /^(Mi |Redmi|POCO|M\d{4})/i.test(model) ? 'Xiaomi' : /^(HUAWEI|HONOR)/i.test(model) ? 'Huawei' : /^(CPH|OnePlus)/i.test(model) ? 'OnePlus / OPPO' : '';
    return { type: /Mobile/.test(ua) ? 'mobile' : 'tablet', vendor, model: model === 'K' ? '' : model };
  }
  if (/Mobile|Opera Mini|IEMobile|Windows Phone/.test(ua)) return { type: 'mobile', vendor: '', model: '' };
  if (os) return { type: 'desktop', vendor: os === 'macOS' ? 'Apple' : '', model: '' };
  return { type: 'unknown', vendor: '', model: '' };
}

function detectEngine(ua: string, browser: string, os: string): UaInfo['engine'] {
  let m: RegExpExecArray | null;
  if (/\bEdge\/([\d.]+)/.test(ua) && !/Edg\//.test(ua)) return { name: 'EdgeHTML', version: (/\bEdge\/([\d.]+)/.exec(ua) as RegExpExecArray)[1] };
  if ((m = /\bTrident\/([\d.]+)/.exec(ua))) return { name: 'Trident', version: m[1] };
  if (os === 'iOS' || os === 'iPadOS') return { name: 'WebKit', version: (/AppleWebKit\/([\d.]+)/.exec(ua) ?? [])[1] ?? '' };
  if (/\bChrome\/|\bCriOS\//.test(ua) && (m = /AppleWebKit\/([\d.]+)/.exec(ua))) return { name: 'Blink', version: (/Chrome\/([\d.]+)/.exec(ua) ?? [])[1] ?? m[1] };
  if ((m = /AppleWebKit\/([\d.]+)/.exec(ua))) return { name: 'WebKit', version: m[1] };
  if ((m = /\brv:([\d.]+)\) Gecko\//.exec(ua)) && browser === 'Firefox') return { name: 'Gecko', version: m[1] };
  if ((m = /\bPresto\/([\d.]+)/.exec(ua))) return { name: 'Presto', version: m[1] };
  return { name: '', version: '' };
}

function detectCpu(ua: string): string {
  if (/aarch64|arm64|\barm\b|ARM64|Apple Silicon/i.test(ua)) return 'arm64';
  if (/armv7|armv8|ARM;/i.test(ua)) return 'arm';
  if (/x86_64|x64|Win64|WOW64|amd64|AMD64/i.test(ua)) return 'x86_64';
  if (/i[3-6]86|x86/i.test(ua)) return 'x86';
  return '';
}

export function tokenizeUserAgent(ua: string): UaInfo['tokens'] {
  const tokens: UaInfo['tokens'] = [];
  const pattern = /\(([^)]*)\)|([^\s()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(ua))) tokens.push(m[1] !== undefined ? { kind: 'comment', text: m[1] } : { kind: 'product', text: m[2] });
  return tokens;
}

export function parseUserAgent(raw: string): UaInfo {
  const ua = raw.trim();
  let browser = { name: '', version: '' };
  for (const [name, pattern] of BROWSER_RULES) {
    const m = pattern.exec(ua);
    if (m) { browser = { name, version: m[1] ?? m[2] ?? '' }; break; }
  }
  const botMatch = BOT_PATTERN.exec(ua);
  const bot = botMatch && !['curl', 'Wget', 'Postman', 'Python Requests'].includes(browser.name) ? botMatch[1] : '';
  const os = detectOs(ua);
  return {
    browser, engine: detectEngine(ua, browser.name, os.name), os, device: detectDevice(ua, os.name, bot),
    cpu: detectCpu(ua), bot, tokens: tokenizeUserAgent(ua),
  };
}

// ---------------------------------------------------------------- chmod

export const CHMOD_CLASSES = ['owner', 'group', 'other'] as const;
export const CHMOD_PERMS = ['read', 'write', 'execute'] as const;
export const CHMOD_SPECIALS = ['setuid', 'setgid', 'sticky'] as const;
export type ChmodClass = typeof CHMOD_CLASSES[number];
export type ChmodPerm = typeof CHMOD_PERMS[number];
export type ChmodSpecial = typeof CHMOD_SPECIALS[number];

const PERM_BIT: Record<ChmodPerm, number> = { read: 4, write: 2, execute: 1 };
const CLASS_SHIFT: Record<ChmodClass, number> = { owner: 6, group: 3, other: 0 };
const SPECIAL_BIT: Record<ChmodSpecial, number> = { setuid: 0o4000, setgid: 0o2000, sticky: 0o1000 };
const CLASS_LETTER: Record<ChmodClass, string> = { owner: 'u', group: 'g', other: 'o' };
const MODE_MAX = 0o7777;

export const hasPerm = (mode: number, cls: ChmodClass, perm: ChmodPerm): boolean => (mode & (PERM_BIT[perm] << CLASS_SHIFT[cls])) !== 0;
export const togglePerm = (mode: number, cls: ChmodClass, perm: ChmodPerm): number => mode ^ (PERM_BIT[perm] << CLASS_SHIFT[cls]);
export const hasSpecial = (mode: number, special: ChmodSpecial): boolean => (mode & SPECIAL_BIT[special]) !== 0;
export const toggleSpecial = (mode: number, special: ChmodSpecial): number => mode ^ SPECIAL_BIT[special];
export const classDigit = (mode: number, cls: ChmodClass): number => (mode >> CLASS_SHIFT[cls]) & 7;

export const chmodOctal = (mode: number): string => {
  const base = mode.toString(8).padStart(3, '0');
  return mode > 0o777 ? base.padStart(4, '0') : base;
};

export function chmodSymbolic(mode: number): string {
  return CHMOD_CLASSES.map((cls) => {
    const d = classDigit(mode, cls);
    const x = d & 1;
    let xs = x ? 'x' : '-';
    if (cls === 'owner' && hasSpecial(mode, 'setuid')) xs = x ? 's' : 'S';
    if (cls === 'group' && hasSpecial(mode, 'setgid')) xs = x ? 's' : 'S';
    if (cls === 'other' && hasSpecial(mode, 'sticky')) xs = x ? 't' : 'T';
    return `${d & 4 ? 'r' : '-'}${d & 2 ? 'w' : '-'}${xs}`;
  }).join('');
}

export function chmodEquals(mode: number): string {
  const classes = CHMOD_CLASSES.map((cls) => {
    const d = classDigit(mode, cls);
    return `${CLASS_LETTER[cls]}=${d & 4 ? 'r' : ''}${d & 2 ? 'w' : ''}${d & 1 ? 'x' : ''}`;
  });
  const specials = [
    hasSpecial(mode, 'setuid') ? 'u+s' : '', hasSpecial(mode, 'setgid') ? 'g+s' : '', hasSpecial(mode, 'sticky') ? 'o+t' : '',
  ].filter(Boolean);
  return [...classes, ...specials].join(',');
}

export function parseOctalMode(text: string): number | null {
  const raw = text.trim().replace(/^0o/i, '');
  return /^[0-7]{3,4}$/.test(raw) ? parseInt(raw, 8) : null;
}

export function parseSymbolicMode(text: string): number | null {
  const raw = text.trim();
  const body = raw.length === 10 ? raw.slice(1) : raw;
  if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(body)) return null;
  let mode = 0;
  CHMOD_CLASSES.forEach((cls, ci) => {
    const [r, w, x] = [body[ci * 3], body[ci * 3 + 1], body[ci * 3 + 2]];
    if (r === 'r') mode |= 4 << CLASS_SHIFT[cls];
    if (w === 'w') mode |= 2 << CLASS_SHIFT[cls];
    if ('xst'.includes(x)) mode |= 1 << CLASS_SHIFT[cls];
    if (cls === 'owner' && (x === 's' || x === 'S')) mode |= SPECIAL_BIT.setuid;
    if (cls === 'group' && (x === 's' || x === 'S')) mode |= SPECIAL_BIT.setgid;
    if (cls === 'other' && (x === 't' || x === 'T')) mode |= SPECIAL_BIT.sticky;
  });
  return mode;
}

/** Applies a symbolic chmod spec such as `u+x,go-w` or `a=rw` to a mode; null when the spec is malformed. */
export function applySymbolicSpec(mode: number, spec: string): number | null {
  let out = mode;
  const clauses = spec.trim().split(',');
  for (const clause of clauses) {
    const m = /^([ugoa]*)([+\-=])([rwxXstugo]*)$/.exec(clause.trim());
    if (!m) return null;
    const who = m[1] === '' || m[1].includes('a') ? 'ugo' : m[1];
    const op = m[2];
    const perms = m[3];
    for (const letter of who) {
      const cls = CHMOD_CLASSES.find((c) => CLASS_LETTER[c] === letter) as ChmodClass;
      const shift = CLASS_SHIFT[cls];
      let bits = 0;
      for (const p of perms) {
        if (p === 'r') bits |= 4;
        else if (p === 'w') bits |= 2;
        else if (p === 'x') bits |= 1;
        else if (p === 'X') bits |= (out & 0o111) !== 0 ? 1 : 0;
        else if (p === 'u' || p === 'g' || p === 'o') bits |= classDigit(out, CHMOD_CLASSES.find((c) => CLASS_LETTER[c] === p) as ChmodClass);
      }
      let special = 0;
      if (perms.includes('s') && letter === 'u') special |= SPECIAL_BIT.setuid;
      if (perms.includes('s') && letter === 'g') special |= SPECIAL_BIT.setgid;
      if (perms.includes('t') && letter === 'o') special |= SPECIAL_BIT.sticky;
      const specialMask = letter === 'u' ? SPECIAL_BIT.setuid : letter === 'g' ? SPECIAL_BIT.setgid : SPECIAL_BIT.sticky;
      if (op === '+') out |= (bits << shift) | special;
      else if (op === '-') out &= ~((bits << shift) | special);
      else out = (out & ~(7 << shift) & ~specialMask) | (bits << shift) | special;
    }
  }
  return out & MODE_MAX;
}

// ---------------------------------------------------------------- ports

export const PORT_MIN = 1;
export const PORT_MAX = 65535;
export const WELL_KNOWN_LIMIT = 1023;
export const REGISTERED_LIMIT = 49151;

export const SERVICE_PORTS: Record<number, string> = {
  20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 67: 'dhcp', 69: 'tftp', 80: 'http', 110: 'pop3', 123: 'ntp',
  143: 'imap', 161: 'snmp', 389: 'ldap', 443: 'https', 445: 'smb', 465: 'smtps', 514: 'syslog', 587: 'submission', 636: 'ldaps', 993: 'imaps',
  995: 'pop3s', 1433: 'mssql', 1521: 'oracle', 1883: 'mqtt', 2049: 'nfs', 2375: 'docker', 3000: 'dev', 3306: 'mysql', 3389: 'rdp', 5000: 'dev',
  5432: 'postgres', 5672: 'amqp', 5900: 'vnc', 6379: 'redis', 8000: 'dev', 8080: 'http-alt', 8443: 'https-alt', 8888: 'alt', 9000: 'alt',
  9092: 'kafka', 9200: 'elasticsearch', 11211: 'memcached', 15672: 'rabbitmq', 27017: 'mongodb',
};

export type PortClass = 'well_known' | 'registered' | 'dynamic';

export const portClass = (port: number): PortClass => (port <= WELL_KNOWN_LIMIT ? 'well_known' : port <= REGISTERED_LIMIT ? 'registered' : 'dynamic');

const randomBelow = (limit: number): number => {
  const max = 0x100000000;
  const cutoff = max - (max % limit);
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= cutoff);
  return buf[0] % limit;
};

export interface PortOptions { min: number; max: number; count: number; unique: boolean; skipServices: boolean; sorted: boolean }

export function generatePorts(options: PortOptions): number[] | null {
  const min = Math.max(PORT_MIN, Math.min(options.min, options.max));
  const max = Math.min(PORT_MAX, Math.max(options.min, options.max));
  const blocked = (p: number): boolean => options.skipServices && p in SERVICE_PORTS;
  const span = max - min + 1;
  let free = span;
  if (options.skipServices) for (const key of Object.keys(SERVICE_PORTS)) { const p = Number(key); if (p >= min && p <= max) free -= 1; }
  if (free < 1 || (options.unique && options.count > free)) return null;
  const picked = new Set<number>();
  const out: number[] = [];
  while (out.length < options.count) {
    const port = min + randomBelow(span);
    if (blocked(port) || (options.unique && picked.has(port))) continue;
    picked.add(port);
    out.push(port);
  }
  return options.sorted ? out.sort((a, b) => a - b) : out;
}
