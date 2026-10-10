/**
 * Image decoding and compression on top of ImageOps, for every app (web, Capacitor WebView, Electron):
 * browser formats plus camera raw (DNG, NEF, CR2, ARW... through LibRaw in a worker), fitting by short/long
 * side, and encoding to a byte budget with a quality ladder then progressive shrinking.
 */
import {
  createCanvas, encodeImage, resizeImage, type ImageMime, type ImageSource, type PixelSize,
} from './ImageOps';

export interface DecodedImage extends PixelSize {
  source: ImageSource;
  release: () => void;
}

export interface ImageFitLimits {
  /** Shorter side cap: 1080 keeps any orientation at 1080p. */
  maxShortSide?: number;
  maxLongSide?: number;
}

export interface ImageEncodeBudget {
  maxBytes: number;
  mime?: ImageMime;
  qualities?: readonly number[];
  /** Factor applied to both sides when no quality fits. */
  shrinkFactor?: number;
  minSide?: number;
}

export interface ImageCompressPolicy extends ImageFitLimits {
  /** Images above this many bytes are re-encoded even when their size fits. */
  maxBytes: number;
  qualities?: readonly number[];
}

export interface ImageCompressResult {
  file: File;
  compressed: boolean;
  original: PixelSize & { bytes: number };
  result: PixelSize & { bytes: number };
}

const JPEG_MIME: ImageMime = 'image/jpeg';
export const DEFAULT_QUALITIES = [0.88, 0.8, 0.7, 0.6] as const;
const DEFAULT_SHRINK_FACTOR = 0.75;
const DEFAULT_MIN_SIDE = 64;
const JPEG_EXTENSION = '.jpg';
const RGBA_CHANNELS = 4;
const OPAQUE = 255;
/** Formats every WebView renders and pycore accepts as they are. */
const PASSTHROUGH_MIME = /^image\/(png|jpeg|gif|webp|bmp)$/i;
/** TIFF container magic (little / big endian): DNG and most camera raws. */
const TIFF_MAGIC = [[0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a]];
const RAW_EXTENSION = /\.(dng|nef|nrw|cr2|cr3|arw|srf|sr2|orf|rw2|raf|pef|srw|3fr|iiq|rwl|x3f|tiff?)$/i;
const RAW_MIME = /^image\/(tiff|x-adobe-dng|x-[a-z]+-[a-z0-9]+|x-[a-z0-9-]*raw)$/i;
/** Raw sensors decode at half size whenever that still covers the requested short side. */
const RAW_HALF_SIZE_FACTOR = 2;

function hasTiffMagic(head: Uint8Array): boolean {
  return TIFF_MAGIC.some((magic) => magic.every((byte, index) => head[index] === byte));
}

export function isRawImageFile(file: File): boolean {
  return RAW_EXTENSION.test(file.name) || RAW_MIME.test(file.type);
}

export function fitDimensions(size: PixelSize, limits: ImageFitLimits): PixelSize {
  const shortSide = Math.min(size.width, size.height);
  const longSide = Math.max(size.width, size.height);
  let scale = 1;
  if (limits.maxShortSide && shortSide > limits.maxShortSide) scale = Math.min(scale, limits.maxShortSide / shortSide);
  if (limits.maxLongSide && longSide > limits.maxLongSide) scale = Math.min(scale, limits.maxLongSide / longSide);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

async function decodeBrowserImage(blob: Blob): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Older WebViews reject some options or formats: the element decoder is the fallback.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const element = new Image();
    element.src = url;
    await element.decode();
    return { source: element, width: element.naturalWidth, height: element.naturalHeight, release: () => undefined };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface LibRawImage { width: number; height: number; colors?: number; data: Uint8Array }

async function decodeRawImage(blob: Blob, halfSizeShortSide: number): Promise<DecodedImage | null> {
  const { default: LibRaw } = await import('libraw-wasm');
  const raw = new LibRaw();
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await raw.open(bytes.slice(0), { useCameraWb: true, outputBps: 8 });
    const meta = await raw.metadata() as { width?: number; height?: number };
    const halfSize = halfSizeShortSide > 0
      && Math.min(Number(meta.width) || 0, Number(meta.height) || 0) / RAW_HALF_SIZE_FACTOR >= halfSizeShortSide;
    if (halfSize) await raw.open(bytes, { useCameraWb: true, outputBps: 8, halfSize: true });
    const decoded = await raw.imageData() as LibRawImage;
    const pixels = decoded.width * decoded.height;
    const channels = decoded.colors || Math.round(decoded.data.length / pixels);
    const rgba = new Uint8ClampedArray(pixels * RGBA_CHANNELS);
    for (let pixel = 0, from = 0, to = 0; pixel < pixels; pixel += 1, from += channels, to += RGBA_CHANNELS) {
      rgba[to] = decoded.data[from];
      rgba[to + 1] = decoded.data[from + Math.min(1, channels - 1)];
      rgba[to + 2] = decoded.data[from + Math.min(2, channels - 1)];
      rgba[to + 3] = OPAQUE;
    }
    const canvas = createCanvas(decoded.width, decoded.height);
    canvas.getContext('2d')?.putImageData(new ImageData(rgba, decoded.width, decoded.height), 0, 0);
    return { source: canvas, width: canvas.width, height: canvas.height, release: () => undefined };
  } catch {
    return null;
  } finally {
    raw.dispose();
  }
}

/** Upright decoded image, or null when it cannot be decoded here. `rawShortSide` lets raw decode at half size. */
export async function decodeImage(blob: Blob, rawShortSide = 0): Promise<DecodedImage | null> {
  const head = new Uint8Array(await blob.slice(0, TIFF_MAGIC[0].length).arrayBuffer());
  if (hasTiffMagic(head) || (blob instanceof File && isRawImageFile(blob))) {
    const raw = await decodeRawImage(blob, rawShortSide);
    if (raw) return raw;
  }
  return decodeBrowserImage(blob);
}

/** Encoded image at most `maxBytes`: lower quality first, then smaller sides; null when even `minSide` misses. */
export async function encodeWithin(image: DecodedImage, size: PixelSize, budget: ImageEncodeBudget): Promise<{ blob: Blob; size: PixelSize } | null> {
  const mime = budget.mime ?? JPEG_MIME;
  const qualities = budget.qualities ?? DEFAULT_QUALITIES;
  const shrink = budget.shrinkFactor ?? DEFAULT_SHRINK_FACTOR;
  const minSide = budget.minSide ?? DEFAULT_MIN_SIDE;
  let target = size;
  while (Math.min(target.width, target.height) >= minSide) {
    const canvas = resizeImage(image.source, target.width, target.height);
    for (const quality of qualities) {
      const blob = await encodeImage(canvas, mime, quality);
      if (blob.size <= budget.maxBytes) return { blob, size: target };
    }
    target = { width: Math.round(target.width * shrink), height: Math.round(target.height * shrink) };
  }
  return null;
}

function renamed(name: string, extension: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name || 'image'}${extension}`;
}

/**
 * Compress an image file on the device: sides above the policy limits are scaled down proportionally, and an
 * image still heavier than `maxBytes` (or not renderable as uploaded, e.g. DNG) is re-encoded as JPEG. A
 * renderable image within every limit is returned unchanged. Null when the file cannot be decoded here.
 */
export async function compressImageFile(file: File, policy: ImageCompressPolicy): Promise<ImageCompressResult | null> {
  const image = await decodeImage(file, policy.maxShortSide ?? 0);
  if (!image) return null;
  try {
    const original = { width: image.width, height: image.height, bytes: file.size };
    const fitted = fitDimensions(image, policy);
    const resized = fitted.width !== image.width || fitted.height !== image.height;
    if (!resized && file.size <= policy.maxBytes && PASSTHROUGH_MIME.test(file.type)) {
      return { file, compressed: false, original, result: original };
    }
    const encoded = await encodeWithin(image, fitted, { maxBytes: policy.maxBytes, qualities: policy.qualities });
    if (!encoded) return null;
    const output = new File([encoded.blob], renamed(file.name, JPEG_EXTENSION), { type: JPEG_MIME, lastModified: file.lastModified });
    return { file: output, compressed: true, original, result: { ...encoded.size, bytes: output.size } };
  } catch {
    return null;
  } finally {
    image.release();
  }
}
