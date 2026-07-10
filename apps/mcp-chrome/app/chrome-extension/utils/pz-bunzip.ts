/**
 * Minimal bzip2 decompressor for Duoreader .pz (browser-safe, no Node APIs).
 * Based on antimatter15/bzip2.js (MIT).
 */

const XOR_KEY = 175;
const BITMASK = [0, 0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff];

function arrayReader(bytes: number[]) {
  let bit = 0;
  let byte = 0;
  return function read(n: number): number {
    let result = 0;
    while (n > 0) {
      const left = 8 - bit;
      if (n >= left) {
        result <<= left;
        result |= BITMASK[left] & bytes[byte++];
        bit = 0;
        n -= left;
      } else {
        result <<= n;
        result |= (bytes[byte] & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit);
        bit += n;
        n = 0;
      }
    }
    return result;
  };
}

function header(bits: (n: number) => number): number {
  if (bits(8 * 3) !== 0x425a68) throw new Error('No bzip magic');
  const i = bits(8) - 48;
  if (i < 1 || i > 9) throw new Error('Not a BZIP archive');
  return i;
}

function decompress(bits: (n: number) => number, size: number, len?: number): number[] | -1 {
  const MAX_HUFCODE_BITS = 20;
  const MAX_SYMBOLS = 258;
  const SYMBOL_RUNA = 0;
  const SYMBOL_RUNB = 1;
  const GROUP_SIZE = 50;

  const bufsize = 100000 * size;
  let h = '';
  for (let i = 0; i < 6; i += 1) h += bits(8).toString(16);
  if (h === '177245385090') return -1;
  if (h !== '314159265359') throw new Error('Invalid bzip block');
  bits(32);
  if (bits(1)) throw new Error('Obsolete bzip version');
  const origPtr = bits(24);
  if (origPtr > bufsize) throw new Error('origPtr out of range');
  let t = bits(16);
  const symToByte = new Uint8Array(256);
  let symTotal = 0;
  for (let i = 0; i < 16; i += 1) {
    if (t & (1 << (15 - i))) {
      const k = bits(16);
      for (let j = 0; j < 16; j += 1) {
        if (k & (1 << (15 - j))) {
          symToByte[symTotal++] = 16 * i + j;
        }
      }
    }
  }

  const groupCount = bits(3);
  if (groupCount < 2 || groupCount > 6) throw new Error('bad groupCount');
  const nSelectors = bits(15);
  if (nSelectors === 0) throw new Error('no selectors');
  const mtfSymbol: number[] = [];
  for (let i = 0; i < groupCount; i += 1) mtfSymbol[i] = i;
  const selectors = new Uint8Array(32768);
  for (let i = 0; i < nSelectors; i += 1) {
    let j = 0;
    while (bits(1)) {
      j += 1;
      if (j >= groupCount) throw new Error('bad selector');
    }
    const uc = mtfSymbol[j];
    mtfSymbol.splice(j, 1);
    mtfSymbol.splice(0, 0, uc);
    selectors[i] = uc;
  }

  const symCount = symTotal + 2;
  const groups: Array<{
    permute: Uint32Array;
    limit: Uint32Array;
    base: Uint32Array;
    minLen: number;
    maxLen: number;
  }> = [];
  for (let j = 0; j < groupCount; j += 1) {
    const length = new Uint8Array(MAX_SYMBOLS);
    const temp = new Uint8Array(MAX_HUFCODE_BITS + 1);
    t = bits(5);
    for (let i = 0; i < symCount; i += 1) {
      while (true) {
        if (t < 1 || t > MAX_HUFCODE_BITS) throw new Error('bad huff len');
        if (!bits(1)) break;
        if (!bits(1)) t += 1;
        else t -= 1;
      }
      length[i] = t;
    }
    let minLen = length[0];
    let maxLen = length[0];
    for (let i = 1; i < symCount; i += 1) {
      if (length[i] > maxLen) maxLen = length[i];
      else if (length[i] < minLen) minLen = length[i];
    }
    const hufGroup = {
      permute: new Uint32Array(MAX_SYMBOLS),
      limit: new Uint32Array(MAX_HUFCODE_BITS + 1),
      base: new Uint32Array(MAX_HUFCODE_BITS + 1),
      minLen,
      maxLen,
    };
    const base = hufGroup.base.subarray(1);
    const limit = hufGroup.limit.subarray(1);
    let pp = 0;
    for (let i = minLen; i <= maxLen; i += 1) {
      for (let ti = 0; ti < symCount; ti += 1) {
        if (length[ti] === i) hufGroup.permute[pp++] = ti;
      }
    }
    for (let i = minLen; i <= maxLen; i += 1) temp[i] = limit[i] = 0;
    for (let i = 0; i < symCount; i += 1) temp[length[i]] += 1;
    pp = 0;
    t = 0;
    for (let i = minLen; i < maxLen; i += 1) {
      pp += temp[i];
      limit[i] = pp - 1;
      pp <<= 1;
      base[i + 1] = pp - (t += temp[i]);
    }
    limit[maxLen] = pp + temp[maxLen] - 1;
    base[minLen] = 0;
    groups[j] = hufGroup;
  }

  const byteCount = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) mtfSymbol[i] = i;
  let runPos = 0;
  let count = 0;
  let symLeft = 0;
  let selector = 0;
  const buf = new Uint32Array(bufsize);
  let hufGroup = groups[0];
  let base = hufGroup.base.subarray(1);
  let limit = hufGroup.limit.subarray(1);

  while (true) {
    if (!(symLeft--)) {
      symLeft = GROUP_SIZE - 1;
      if (selector >= nSelectors) throw new Error('selector overflow');
      hufGroup = groups[selectors[selector++]];
      base = hufGroup.base.subarray(1);
      limit = hufGroup.limit.subarray(1);
    }
    let i = hufGroup.minLen;
    let j = bits(i);
    while (true) {
      if (i > hufGroup.maxLen) throw new Error('huff overflow');
      if (j <= limit[i]) break;
      i += 1;
      j = (j << 1) | bits(1);
    }
    j -= base[i];
    if (j < 0 || j >= MAX_SYMBOLS) throw new Error('bad symbol');
    const nextSym = hufGroup.permute[j];
    if (nextSym === SYMBOL_RUNA || nextSym === SYMBOL_RUNB) {
      if (!runPos) {
        runPos = 1;
        t = 0;
      }
      if (nextSym === SYMBOL_RUNA) t += runPos;
      else t += 2 * runPos;
      runPos <<= 1;
      continue;
    }
    if (runPos) {
      runPos = 0;
      if (count + t >= bufsize) throw new Error('buf overflow');
      const uc = symToByte[mtfSymbol[0]];
      byteCount[uc] += t;
      while (t--) buf[count++] = uc;
    }
    if (nextSym > symTotal) break;
    if (count >= bufsize) throw new Error('buf overflow2');
    const idx = nextSym - 1;
    const ucMtf = mtfSymbol[idx];
    mtfSymbol.splice(idx, 1);
    mtfSymbol.splice(0, 0, ucMtf);
    const uc = symToByte[ucMtf];
    byteCount[uc] += 1;
    buf[count++] = uc;
  }

  if (origPtr < 0 || origPtr >= count) throw new Error('bad origPtr');
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    const k = j + byteCount[i];
    byteCount[i] = j;
    j = k;
  }
  for (let i = 0; i < count; i += 1) {
    const uc = buf[i] & 0xff;
    buf[byteCount[uc]] |= i << 8;
    byteCount[uc] += 1;
  }

  let pos = 0;
  let current = 0;
  let run = 0;
  if (count) {
    pos = buf[origPtr];
    current = pos & 0xff;
    pos >>= 8;
    run = -1;
  }
  const out: number[] = [];
  const maxLen = len || Infinity;
  while (count) {
    count -= 1;
    const previous = current;
    pos = buf[pos];
    current = pos & 0xff;
    pos >>= 8;
    if ((run += 1) === 3) {
      t = current;
      current = -1;
      while (t--) {
        out.push(previous);
        if (out.length >= maxLen) return out;
      }
    } else {
      out.push(current);
      if (out.length >= maxLen) return out;
    }
    if (current !== previous) run = 0;
  }
  return out;
}

function simple(bits: (n: number) => number): number[] {
  const size = header(bits);
  const chunks: number[] = [];
  let chunk: number[] | -1;
  do {
    chunk = decompress(bits, size);
    if (chunk !== -1) chunks.push(...chunk);
  } while (chunk !== -1);
  return chunks;
}

export function unpackDuoreaderPzBytes(byteList: ArrayLike<number>): Uint8Array {
  const xored: number[] = [];
  for (let i = 0; i < byteList.length; i += 1) {
    xored[i] = (byteList[i] ^ XOR_KEY) & 0xff;
  }
  const bits = arrayReader(xored);
  return Uint8Array.from(simple(bits));
}
