/**
 * Synchronous MD5 / SHA-256 hex digests of UTF-8 text, for content identities
 * shared with pycore (hashlib) and Laravel (md5()) where an async WebCrypto
 * digest cannot be used (pure planners, sort keys) and WebCrypto has no MD5.
 */

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function hex(words: number[], littleEndian: boolean): string {
  let out = '';
  for (const word of words) {
    for (let index = 0; index < 4; index += 1) {
      const shift = littleEndian ? index * 8 : 24 - index * 8;
      out += ((word >>> shift) & 0xff).toString(16).padStart(2, '0');
    }
  }
  return out;
}

/** Message padded to 64-byte blocks with its bit length (little or big endian). */
function padded(bytes: Uint8Array, littleEndian: boolean): DataView {
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(length);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  const bits = bytes.length * 8;
  const high = Math.floor(bits / 0x100000000);
  const low = bits >>> 0;
  if (littleEndian) {
    view.setUint32(length - 8, low, true);
    view.setUint32(length - 4, high, true);
  } else {
    view.setUint32(length - 8, high, false);
    view.setUint32(length - 4, low, false);
  }
  return view;
}

const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);

export function md5Hex(text: string): string {
  const view = padded(utf8(text), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      const round = index >> 4;
      let f: number;
      let g: number;
      if (round === 0) { f = (b & c) | (~b & d); g = index; }
      else if (round === 1) { f = (d & b) | (~d & c); g = (5 * index + 1) % 16; }
      else if (round === 2) { f = b ^ c ^ d; g = (3 * index + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * index) % 16; }
      const shift = MD5_SHIFTS[round * 4 + (index % 4)];
      const sum = (a + f + MD5_K[index] + view.getUint32(offset + g * 4, true)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  return hex([a0, b0, c0, d0], true);
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

export function sha256Hex(text: string): string {
  const view = padded(utf8(text), false);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3);
      const s1 = rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[index] + w[index]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
  }
  return hex(hash, false);
}
