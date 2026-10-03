/** Browser crypto primitives shared by the crypto workbenches: encodings, digests, HMAC, randomness. */
export type DigestAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export type HmacAlgorithm = DigestAlgorithm;

const HEX_DIGITS = '0123456789abcdef';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_CONSTANTS = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
const MD5_BLOCK_BYTES = 64;
const HMAC_BLOCK_BYTES: Record<DigestAlgorithm, number> = { MD5: 64, 'SHA-1': 64, 'SHA-256': 64, 'SHA-384': 128, 'SHA-512': 128 };
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const DIGEST_ALGORITHMS: readonly DigestAlgorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

export const utf8Encode = (text: string): Uint8Array => textEncoder.encode(text);

export const utf8Decode = (bytes: Uint8Array): string => textDecoder.decode(bytes);

export const toHex = (bytes: Uint8Array): string => {
  let out = '';
  for (const byte of bytes) out += HEX_DIGITS[byte >> 4] + HEX_DIGITS[byte & 15];
  return out;
};

export const fromHex = (hex: string): Uint8Array | null => {
  const clean = hex.replace(/[\s:]/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export const fromBase64 = (text: string): Uint8Array | null => {
  try {
    const binary = atob(text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
};

export const toBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

export const fromBase32 = (text: string): Uint8Array | null => {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
};

export const randomBytes = (length: number): Uint8Array => {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
};

/** Uniform integer in [0, max) without modulo bias. */
export const randomInt = (max: number): number => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % max;
};

export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const rotl = (value: number, shift: number): number => (value << shift) | (value >>> (32 - shift));

/** RFC 1321 MD5 (Web Crypto has no MD5). */
export const md5 = (data: Uint8Array): Uint8Array => {
  const paddedLength = Math.ceil((data.length + 9) / MD5_BLOCK_BYTES) * MD5_BLOCK_BYTES;
  const padded = new Uint8Array(paddedLength);
  const view = new DataView(padded.buffer);
  padded.set(data);
  padded[data.length] = 0x80;
  view.setUint32(paddedLength - 8, (data.length * 8) >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(data.length / 0x20000000), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89 | 0;
  let c0 = 0x98badcfe | 0;
  let d0 = 0x10325476;
  for (let offset = 0; offset < paddedLength; offset += MD5_BLOCK_BYTES) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const mixed = (f + a + MD5_CONSTANTS[i] + view.getUint32(offset + g * 4, true)) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(mixed, MD5_SHIFTS[(i >> 4) * 4 + (i % 4)])) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, index) => outView.setUint32(index * 4, word >>> 0, true));
  return out;
};

export const digest = async (algorithm: DigestAlgorithm, data: Uint8Array): Promise<Uint8Array> => {
  if (algorithm === 'MD5') return md5(data);
  return new Uint8Array(await crypto.subtle.digest(algorithm, data));
};

/** HMAC over any digest: Web Crypto for SHA with a key, RFC 2104 by hand for MD5 and empty keys (Web Crypto rejects those). */
export const hmac = async (algorithm: HmacAlgorithm, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  if (algorithm !== 'MD5' && key.length > 0) {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: algorithm }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
  }
  const block = HMAC_BLOCK_BYTES[algorithm];
  const normalized = key.length > block ? await digest(algorithm, key) : key;
  const inner = new Uint8Array(block).fill(0x36);
  const outer = new Uint8Array(block).fill(0x5c);
  normalized.forEach((byte, i) => { inner[i] ^= byte; outer[i] ^= byte; });
  return digest(algorithm, concatBytes(outer, await digest(algorithm, concatBytes(inner, data))));
};

export const sha256Fingerprint = async (data: Uint8Array): Promise<string> => toHex(await digest('SHA-256', data));
