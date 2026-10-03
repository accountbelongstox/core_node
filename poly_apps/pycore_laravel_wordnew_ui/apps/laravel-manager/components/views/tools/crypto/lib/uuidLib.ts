/** UUID v1/v3/v4/v5/v7 and ULID generation plus identifier inspection, all in the browser. */
import { concatBytes, digest, fromHex, md5, randomBytes, toHex, utf8Encode } from './cryptoCore';

export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5' | 'v7' | 'ulid' | 'nil';

export interface UuidFormat {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export interface UuidInspection {
  kind: 'uuid' | 'ulid';
  version: number | null;
  variant: string;
  timestamp: Date | null;
  normalized: string;
}

export const UUID_NAMESPACES: Record<'dns' | 'url' | 'oid' | 'x500', string> = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
};

const GREGORIAN_OFFSET_MS = 12219292800000n;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_LENGTH = 26;
const ULID_RANDOM_BITS = 80n;
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;
const UUID_PATTERN = /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i;
const V7_COUNTER_SEED = 2048;
const v1Node = (() => {
  const node = randomBytes(6);
  node[0] |= 1;
  return node;
})();
const v1ClockSeq = randomBytes(2);

const stamp = (bytes: Uint8Array, version: number): Uint8Array => {
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
};

const hyphenate = (hex: string): string => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

export const formatUuid = (canonical: string, format: UuidFormat): string => {
  let value = format.hyphens ? canonical : canonical.replace(/-/g, '');
  if (format.uppercase) value = value.toUpperCase();
  return format.braces ? `{${value}}` : value;
};

export const parseUuidBytes = (text: string): Uint8Array | null => {
  const match = UUID_PATTERN.exec(text.trim());
  return match ? fromHex(match.slice(1).join('')) : null;
};

const v1Bytes = (offset: number): Uint8Array => {
  const ticks = (BigInt(Date.now()) + GREGORIAN_OFFSET_MS) * 10000n + BigInt(offset);
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, Number(ticks & 0xffffffffn));
  view.setUint16(4, Number((ticks >> 32n) & 0xffffn));
  view.setUint16(6, Number((ticks >> 48n) & 0x0fffn));
  out[8] = v1ClockSeq[0];
  out[9] = v1ClockSeq[1];
  out.set(v1Node, 10);
  return stamp(out, 1);
};

const v7Bytes = (counter: number): Uint8Array => {
  const out = randomBytes(16);
  const view = new DataView(out.buffer);
  const now = BigInt(Date.now());
  view.setUint32(0, Number((now >> 16n) & 0xffffffffn));
  view.setUint16(4, Number(now & 0xffffn));
  out[6] = counter >> 8;
  out[7] = counter & 0xff;
  return stamp(out, 7);
};

export const hashedUuidBytes = async (version: 'v3' | 'v5', namespace: Uint8Array, name: string): Promise<Uint8Array> => {
  const input = concatBytes(namespace, utf8Encode(name));
  const hashed = version === 'v3' ? md5(input) : (await digest('SHA-1', input)).slice(0, 16);
  return stamp(hashed.slice(0, 16), version === 'v3' ? 3 : 5);
};

const encodeUlid = (value: bigint): string => {
  let rest = value;
  let out = '';
  for (let i = 0; i < ULID_LENGTH; i++) {
    out = CROCKFORD[Number(rest & 31n)] + out;
    rest >>= 5n;
  }
  return out;
};

/** ULIDs of one batch share the millisecond and stay monotonic by incrementing the random part. */
export const generateUlids = (count: number, now = Date.now()): string[] => {
  const random = BigInt(`0x${toHex(randomBytes(10))}`);
  const mask = (1n << ULID_RANDOM_BITS) - 1n;
  return Array.from({ length: count }, (_, i) => encodeUlid((BigInt(now) << ULID_RANDOM_BITS) | ((random + BigInt(i)) & mask)));
};

export interface UuidBatchOptions {
  version: UuidVersion;
  count: number;
  format: UuidFormat;
  namespace?: Uint8Array;
  name?: string;
}

/** Creates the requested batch; v3/v5 are deterministic and always yield a single value. */
export const generateIdentifiers = async (options: UuidBatchOptions): Promise<string[]> => {
  const { version, count, format, namespace, name = '' } = options;
  if (version === 'ulid') return generateUlids(count);
  if (version === 'nil') return [formatUuid('00000000-0000-0000-0000-000000000000', format)];
  if (version === 'v3' || version === 'v5') {
    const bytes = await hashedUuidBytes(version, namespace ?? new Uint8Array(16), name);
    return [formatUuid(hyphenate(toHex(bytes)), format)];
  }
  const counterSeed = Math.floor(Math.random() * V7_COUNTER_SEED);
  return Array.from({ length: count }, (_, i) => {
    const bytes = version === 'v1' ? v1Bytes(i) : version === 'v7' ? v7Bytes(counterSeed + i) : stamp(randomBytes(16), 4);
    return formatUuid(hyphenate(toHex(bytes)), format);
  });
};

const variantOf = (byte: number): string => {
  if ((byte & 0x80) === 0) return 'ncs';
  if ((byte & 0xc0) === 0x80) return 'rfc4122';
  if ((byte & 0xe0) === 0xc0) return 'microsoft';
  return 'future';
};

/** Reads version, variant and embedded time from a UUID or ULID; null when the text is neither. */
export const inspectIdentifier = (text: string): UuidInspection | null => {
  const value = text.trim();
  if (ULID_PATTERN.test(value)) {
    const upper = value.toUpperCase();
    const time = [...upper.slice(0, 10)].reduce((sum, char) => sum * 32 + CROCKFORD.indexOf(char), 0);
    return { kind: 'ulid', version: null, variant: 'ulid', timestamp: new Date(time), normalized: upper };
  }
  const bytes = parseUuidBytes(value);
  if (!bytes) return null;
  const version = bytes[6] >> 4;
  const view = new DataView(bytes.buffer);
  let timestamp: Date | null = null;
  if (version === 1) {
    const ticks = (BigInt(view.getUint16(6) & 0x0fff) << 48n) | (BigInt(view.getUint16(4)) << 32n) | BigInt(view.getUint32(0));
    timestamp = new Date(Number(ticks / 10000n - GREGORIAN_OFFSET_MS));
  } else if (version === 7) {
    timestamp = new Date((view.getUint32(0) * 0x10000) + view.getUint16(4));
  }
  const isNil = bytes.every((byte) => byte === 0);
  return { kind: 'uuid', version: isNil ? 0 : version, variant: variantOf(bytes[8]), timestamp, normalized: hyphenate(toHex(bytes)) };
};
