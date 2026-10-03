/** Dominant-color extraction (median cut and k-means) and color formatting for the color extractor. */
export type Rgb = [number, number, number];
export type PaletteAlgorithm = 'medianCut' | 'kMeans';

export interface PaletteColor { rgb: Rgb; share: number }

const SAMPLE_SIDE = 96;
const ALPHA_THRESHOLD = 125;
const KMEANS_ITERATIONS = 14;
const KMEANS_SEED = 0x2f6e2b1;
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 4294967296;
const LUMA_WEIGHTS: Rgb = [0.2126, 0.7152, 0.0722];
const LIGHT_TEXT_THRESHOLD = 0.5;
const HEX_RADIX = 16;

export const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(HEX_RADIX).padStart(2, '0')).join('').toUpperCase()}`;

export const rgbToHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
};

export const isLightColor = (rgb: Rgb): boolean =>
  (rgb[0] * LUMA_WEIGHTS[0] + rgb[1] * LUMA_WEIGHTS[1] + rgb[2] * LUMA_WEIGHTS[2]) / 255 > LIGHT_TEXT_THRESHOLD;

/** Opaque pixels of the source scaled down to a small sample, as a flat RGB array. */
export const samplePixels = (source: HTMLImageElement | HTMLCanvasElement): Uint8ClampedArray => {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, SAMPLE_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas_unsupported');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8ClampedArray((data.length / 4) * 3);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_THRESHOLD) continue;
    rgb[count++] = data[i];
    rgb[count++] = data[i + 1];
    rgb[count++] = data[i + 2];
  }
  return rgb.slice(0, count);
};

const average = (pixels: Uint8ClampedArray, indices: number[]): Rgb => {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of indices) {
    r += pixels[i * 3];
    g += pixels[i * 3 + 1];
    b += pixels[i * 3 + 2];
  }
  const n = Math.max(1, indices.length);
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
};

const channelRange = (pixels: Uint8ClampedArray, indices: number[]): { channel: number; range: number } => {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const i of indices) {
    for (let c = 0; c < 3; c += 1) {
      const v = pixels[i * 3 + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const channel = ranges.indexOf(Math.max(...ranges));
  return { channel, range: ranges[channel] };
};

/** Split index of a channel-sorted bucket that minimises the squared error of both halves (never inside a run of equal values). */
const bestCut = (pixels: Uint8ClampedArray, sorted: number[], channel: number): number => {
  const n = sorted.length;
  const prefix = new Float64Array(n + 1);
  const prefixSquares = new Float64Array(n + 1);
  sorted.forEach((pixel, i) => {
    const v = pixels[pixel * 3 + channel];
    prefix[i + 1] = prefix[i] + v;
    prefixSquares[i + 1] = prefixSquares[i] + v * v;
  });
  let best = n >> 1;
  let bestCost = Infinity;
  for (let k = 1; k < n; k += 1) {
    if (pixels[sorted[k - 1] * 3 + channel] === pixels[sorted[k] * 3 + channel]) continue;
    const left = prefixSquares[k] - (prefix[k] * prefix[k]) / k;
    const rightSum = prefix[n] - prefix[k];
    const right = prefixSquares[n] - prefixSquares[k] - (rightSum * rightSum) / (n - k);
    if (left + right < bestCost) {
      bestCost = left + right;
      best = k;
    }
  }
  return best;
};

export const medianCut = (pixels: Uint8ClampedArray, count: number): PaletteColor[] => {
  const total = pixels.length / 3;
  if (total === 0) return [];
  let buckets: number[][] = [Array.from({ length: total }, (_, i) => i)];
  while (buckets.length < count) {
    let target = -1;
    let best = 0;
    buckets.forEach((bucket, index) => {
      if (bucket.length < 2) return;
      const score = channelRange(pixels, bucket).range * Math.sqrt(bucket.length);
      if (score > best) {
        best = score;
        target = index;
      }
    });
    if (target < 0) break;
    const bucket = buckets[target];
    const { channel } = channelRange(pixels, bucket);
    bucket.sort((a, b) => pixels[a * 3 + channel] - pixels[b * 3 + channel]);
    const cut = bestCut(pixels, bucket, channel);
    buckets = [...buckets.slice(0, target), bucket.slice(0, cut), bucket.slice(cut), ...buckets.slice(target + 1)];
  }
  return buckets.filter((b) => b.length > 0)
    .map((bucket) => ({ rgb: average(pixels, bucket), share: bucket.length / total }))
    .sort((a, b) => b.share - a.share);
};

const distance = (pixels: Uint8ClampedArray, i: number, center: Rgb): number => {
  const dr = pixels[i * 3] - center[0];
  const dg = pixels[i * 3 + 1] - center[1];
  const db = pixels[i * 3 + 2] - center[2];
  return dr * dr + dg * dg + db * db;
};

export const kMeans = (pixels: Uint8ClampedArray, count: number): PaletteColor[] => {
  const total = pixels.length / 3;
  if (total === 0) return [];
  let seed = KMEANS_SEED;
  const random = (): number => {
    seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return seed / LCG_MODULUS;
  };
  const pixelAt = (i: number): Rgb => [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]];
  const centers: Rgb[] = [pixelAt(Math.floor(random() * total))];
  const nearest = new Float64Array(total).fill(Infinity);
  while (centers.length < Math.min(count, total)) {
    const last = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < total; i += 1) {
      nearest[i] = Math.min(nearest[i], distance(pixels, i, last));
      sum += nearest[i];
    }
    if (sum === 0) break;
    let pick = random() * sum;
    let chosen = total - 1;
    for (let i = 0; i < total; i += 1) {
      pick -= nearest[i];
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centers.push(pixelAt(chosen));
  }
  const assignment = new Int32Array(total);
  for (let iteration = 0; iteration < KMEANS_ITERATIONS; iteration += 1) {
    for (let i = 0; i < total; i += 1) {
      let best = 0;
      let bestDistance = Infinity;
      centers.forEach((center, index) => {
        const d = distance(pixels, i, center);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      assignment[i] = best;
    }
    centers.forEach((_, index) => {
      const members: number[] = [];
      for (let i = 0; i < total; i += 1) if (assignment[i] === index) members.push(i);
      if (members.length > 0) centers[index] = average(pixels, members);
    });
  }
  const sizes = new Array<number>(centers.length).fill(0);
  for (let i = 0; i < total; i += 1) sizes[assignment[i]] += 1;
  return centers.map((rgb, index) => ({ rgb, share: sizes[index] / total }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
};

export const extractPalette = (pixels: Uint8ClampedArray, count: number, algorithm: PaletteAlgorithm): PaletteColor[] =>
  (algorithm === 'kMeans' ? kMeans(pixels, count) : medianCut(pixels, count));

export const pixelColorAt = (source: HTMLImageElement | HTMLCanvasElement, x: number, y: number): Rgb | null => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a < ALPHA_THRESHOLD ? null : [r, g, b];
};
