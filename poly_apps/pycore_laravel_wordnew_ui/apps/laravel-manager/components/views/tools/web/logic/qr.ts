/** QR Code Model 2 encoder (versions 1-40, numeric / alphanumeric / byte, ECC L-H, automatic mask). */

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export interface QrSymbol {
  version: number;
  ecc: QrEcc;
  mask: number;
  size: number;
  modules: boolean[][];
  mode: QrMode;
}

export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

export class QrCapacityError extends Error {
  constructor() {
    super('qr_capacity');
  }
}

const MIN_VERSION = 1;
const MAX_VERSION = 40;
const ECC_ORDINAL: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODE_BITS: Record<QrMode, number> = { numeric: 0x1, alphanumeric: 0x2, byte: 0x4 };
const COUNT_BITS: Record<QrMode, [number, number, number]> = { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] };
const PAD_BYTES = [0xec, 0x11];
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const ECC_BLOCK_COUNT: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const bitAt = (value: number, index: number): boolean => ((value >>> index) & 1) !== 0;

const rawDataModules = (version: number): number => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
};

const dataCodewords = (version: number, ecc: QrEcc): number => (
  Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[ECC_ORDINAL[ecc]][version] * ECC_BLOCK_COUNT[ECC_ORDINAL[ecc]][version]
);

const gfMultiply = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const rsDivisor = (degree: number): number[] => {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const rsRemainder = (data: number[], divisor: number[]): number[] => {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
  }
  return result;
};

export const detectQrMode = (text: string): QrMode => {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  for (const char of text) if (!ALPHANUMERIC.includes(char)) return 'byte';
  return 'alphanumeric';
};

const appendBits = (bits: number[], value: number, length: number): void => {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
};

const encodeSegment = (text: string, mode: QrMode): { count: number; bits: number[] } => {
  const bits: number[] = [];
  if (mode === 'numeric') {
    for (let i = 0; i < text.length;) {
      const take = Math.min(3, text.length - i);
      appendBits(bits, parseInt(text.substr(i, take), 10), take * 3 + 1);
      i += take;
    }
    return { count: text.length, bits };
  }
  if (mode === 'alphanumeric') {
    let i = 0;
    for (; i + 2 <= text.length; i += 2) appendBits(bits, ALPHANUMERIC.indexOf(text[i]) * 45 + ALPHANUMERIC.indexOf(text[i + 1]), 11);
    if (i < text.length) appendBits(bits, ALPHANUMERIC.indexOf(text[i]), 6);
    return { count: text.length, bits };
  }
  const bytes = new TextEncoder().encode(text);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  return { count: bytes.length, bits };
};

const countBitsFor = (mode: QrMode, version: number): number => COUNT_BITS[mode][version <= 9 ? 0 : version <= 26 ? 1 : 2];

const alignmentPositions = (version: number): number[] => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
};

class Canvas {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly version: number, readonly ecc: QrEcc) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.drawFunctionPatterns();
  }

  readonly size: number;

  private set(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.fixed[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);
    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((cy, i) => positions.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      this.drawAlignment(cx, cy);
    }));
    this.drawFormat(0);
    this.drawVersion();
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.set(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  drawFormat(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) this.set(8, i, bitAt(bits, i));
    this.set(8, 7, bitAt(bits, 6));
    this.set(8, 8, bitAt(bits, 7));
    this.set(7, 8, bitAt(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bitAt(bits, i));
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bitAt(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bitAt(bits, i));
    this.set(8, this.size - 8, true);
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = bitAt(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  }

  drawCodewords(data: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.fixed[y][x] && i < data.length * 8) {
            this.modules[y][x] = bitAt(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!this.fixed[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  penalty(): number {
    const n = this.size;
    const m = this.modules;
    let score = 0;
    const scanLine = (get: (i: number) => boolean): void => {
      let run = 1;
      let history = '';
      for (let i = 0; i < n; i++) {
        const dark = get(i);
        if (i > 0) {
          if (dark === get(i - 1)) {
            run++;
            if (run === 5) score += PENALTY_N1;
            else if (run > 5) score++;
          } else run = 1;
        }
        history += dark ? '1' : '0';
      }
      for (const pattern of ['10111010000', '00001011101']) {
        let at = history.indexOf(pattern);
        while (at >= 0) {
          score += PENALTY_N3;
          at = history.indexOf(pattern, at + 1);
        }
      }
    };
    for (let y = 0; y < n; y++) scanLine((x) => m[y][x]);
    for (let x = 0; x < n; x++) scanLine((y) => m[y][x]);
    let dark = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (m[y][x]) dark++;
        if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += PENALTY_N2;
      }
    }
    const percent = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(percent - 50) / 5) * PENALTY_N4;
    return score;
  }
}

const interleave = (data: number[], version: number, ecc: QrEcc): number[] => {
  const blockCount = ECC_BLOCK_COUNT[ECC_ORDINAL[ecc]][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[ECC_ORDINAL[ecc]][version];
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (raw % blockCount);
  const shortLen = Math.floor(raw / blockCount);
  const blocks: number[][] = [];
  const divisor = rsDivisor(eccLen);
  for (let i = 0, k = 0; i < blockCount; i++) {
    const block = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += block.length;
    const remainder = rsRemainder(block, divisor);
    if (i < shortBlocks) block.push(0);
    blocks.push(block.concat(remainder));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) result.push(block[i]);
    });
  }
  return result;
};

/** Encodes text (UTF-8) into the smallest QR symbol of the requested error-correction level. */
export function encodeQr(text: string, ecc: QrEcc, minVersion: number = MIN_VERSION): QrSymbol {
  const mode = detectQrMode(text);
  const segment = encodeSegment(text, mode);
  let version = Math.max(MIN_VERSION, minVersion);
  for (;; version++) {
    if (version > MAX_VERSION) throw new QrCapacityError();
    const used = 4 + countBitsFor(mode, version) + segment.bits.length;
    if (used <= dataCodewords(version, ecc) * 8 && segment.count < (1 << countBitsFor(mode, version))) break;
  }
  const bits: number[] = [];
  appendBits(bits, MODE_BITS[mode], 4);
  appendBits(bits, segment.count, countBitsFor(mode, version));
  bits.push(...segment.bits);
  const capacityBits = dataCodewords(version, ecc) * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0; bits.length < capacityBits; pad ^= 1) appendBits(bits, PAD_BYTES[pad], 8);
  const codewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((bit, i) => { codewords[i >>> 3] |= bit << (7 - (i & 7)); });

  const canvas = new Canvas(version, ecc);
  canvas.drawCodewords(interleave(codewords, version, ecc));
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    canvas.applyMask(mask);
    canvas.drawFormat(mask);
    const penalty = canvas.penalty();
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    canvas.applyMask(mask);
  }
  canvas.applyMask(bestMask);
  canvas.drawFormat(bestMask);
  return { version, ecc, mask: bestMask, size: canvas.size, modules: canvas.modules, mode };
}
