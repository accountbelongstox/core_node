/** Canvas image operations shared by every app (image workbenches, upload compression); browser and WebView. */
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface PixelRect { x: number; y: number; width: number; height: number }
export interface PixelSize { width: number; height: number }
/** Anything drawable whose pixel size is known. */
export type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export const IMAGE_MIMES: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_PIXELS = 100_000_000;
export const MAX_IMAGE_SIDE = 16384;
const ROUNDING_FACTOR = 1e6;
const HALVING_LIMIT = 2;
const SEARCH_STEPS = 8;
const MIN_QUALITY = 0.05;
const JPEG_BACKGROUND = '#ffffff';

export class ImageTooLargeError extends Error {}

export const isImageFile = (file: File): boolean => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name);

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const assertCanvasSize = (width: number, height: number): void => {
  if (width < 1 || height < 1 || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw new ImageTooLargeError(`${width}x${height}`);
  }
};

export const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const w = Math.round(width);
  const h = Math.round(height);
  assertCanvasSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unsupported');
  ctx.imageSmoothingQuality = 'high';
  return ctx;
};

export const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image_decode_failed'));
  img.src = url;
});

export const sourceSize = (source: ImageSource): PixelSize =>
  source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };

export const rotatedBounds = (width: number, height: number, degrees: number): PixelSize => {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const round = (v: number) => Math.ceil(Math.round(v * ROUNDING_FACTOR) / ROUNDING_FACTOR);
  return { width: round(width * cos + height * sin), height: round(width * sin + height * cos) };
};

export const rotateImage = (
  source: HTMLImageElement | HTMLCanvasElement, degrees: number, expand: boolean, background: string | null,
): HTMLCanvasElement => {
  const { width, height } = sourceSize(source);
  const out = expand ? rotatedBounds(width, height, degrees) : { width, height };
  const canvas = createCanvas(out.width, out.height);
  const ctx = context2d(canvas);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -width / 2, -height / 2);
  return canvas;
};

export const flipImage = (source: HTMLImageElement | HTMLCanvasElement, horizontal: boolean, vertical: boolean): HTMLCanvasElement => {
  const { width, height } = sourceSize(source);
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.translate(horizontal ? width : 0, vertical ? height : 0);
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
};

export const clampRect = (rect: PixelRect, bounds: PixelSize): PixelRect => {
  const width = clamp(Math.round(rect.width), 1, bounds.width);
  const height = clamp(Math.round(rect.height), 1, bounds.height);
  return {
    width,
    height,
    x: clamp(Math.round(rect.x), 0, bounds.width - width),
    y: clamp(Math.round(rect.y), 0, bounds.height - height),
  };
};

export const cropImage = (source: HTMLImageElement | HTMLCanvasElement, rect: PixelRect): HTMLCanvasElement => {
  const canvas = createCanvas(rect.width, rect.height);
  context2d(canvas).drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
};

/** Downscales by repeated halving before the final draw so large reductions stay sharp. */
export const resizeImage = (source: ImageSource, width: number, height: number): HTMLCanvasElement => {
  let current: ImageSource = source;
  let { width: cw, height: ch } = sourceSize(source);
  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(height));
  while (cw / HALVING_LIMIT > targetW && ch / HALVING_LIMIT > targetH) {
    const step = createCanvas(Math.ceil(cw / HALVING_LIMIT), Math.ceil(ch / HALVING_LIMIT));
    context2d(step).drawImage(current, 0, 0, step.width, step.height);
    current = step;
    cw = step.width;
    ch = step.height;
  }
  const canvas = createCanvas(targetW, targetH);
  context2d(canvas).drawImage(current, 0, 0, targetW, targetH);
  return canvas;
};

export const flattenCanvas = (source: ImageSource, background: string = JPEG_BACKGROUND): HTMLCanvasElement => {
  const { width, height } = sourceSize(source);
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  return canvas;
};

export const canvasToBlob = (canvas: HTMLCanvasElement, mime: ImageMime, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))), mime, quality);
  });

/** Encodes a canvas; JPEG is flattened onto a background because it has no alpha channel. */
export const encodeImage = (
  source: HTMLCanvasElement | HTMLImageElement, mime: ImageMime, quality: number, background: string = JPEG_BACKGROUND,
): Promise<Blob> => {
  const flat = mime === 'image/jpeg' ? flattenCanvas(source, background) : source;
  const canvas = flat instanceof HTMLCanvasElement ? flat : flattenOrCopy(flat);
  return canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : quality);
};

const flattenOrCopy = (image: HTMLImageElement): HTMLCanvasElement => {
  const { width, height } = sourceSize(image);
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(image, 0, 0);
  return canvas;
};

/** Browsers silently fall back to PNG for unsupported encoders; this detects real WebP encoding support. */
export const supportsEncoding = (mime: ImageMime): boolean => {
  if (mime === 'image/png') return true;
  try {
    return document.createElement('canvas').toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
};

/** Finds the highest quality whose encoded size stays within targetBytes (null when even the lowest misses). */
export const fitQualityToSize = async (
  source: HTMLCanvasElement | HTMLImageElement, mime: ImageMime, targetBytes: number, background: string = JPEG_BACKGROUND,
): Promise<{ quality: number; blob: Blob } | null> => {
  let low = MIN_QUALITY;
  let high = 1;
  let best: { quality: number; blob: Blob } | null = null;
  const lowest = await encodeImage(source, mime, low, background);
  if (lowest.size > targetBytes) return null;
  best = { quality: low, blob: lowest };
  for (let i = 0; i < SEARCH_STEPS; i += 1) {
    const mid = (low + high) / 2;
    const blob = await encodeImage(source, mime, mid, background);
    if (blob.size <= targetBytes) {
      best = { quality: mid, blob };
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
};

export const ASPECT_PRESETS: ReadonlyArray<{ id: string; ratio: number | null }> = [
  { id: 'free', ratio: null },
  { id: 'original', ratio: 0 },
  { id: '1:1', ratio: 1 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '3:2', ratio: 3 / 2 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '9:16', ratio: 9 / 16 },
];

/** Largest centered rect of the given aspect ratio that fits in the bounds. */
export const fitAspect = (bounds: PixelSize, ratio: number): PixelRect => {
  let width = bounds.width;
  let height = Math.round(width / ratio);
  if (height > bounds.height) {
    height = bounds.height;
    width = Math.round(height * ratio);
  }
  return clampRect({ x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height }, bounds);
};

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Applies a drag of (dx, dy) source pixels to a crop rect; ratio keeps the aspect when set. */
export const dragCropRect = (start: PixelRect, handle: CropHandle, dx: number, dy: number, bounds: PixelSize, ratio: number | null): PixelRect => {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, bounds.width - start.width), y: clamp(start.y + dy, 0, bounds.height - start.height) };
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - 1);
  if (handle.includes('e')) right = clamp(right + dx, left + 1, bounds.width);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - 1);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + 1, bounds.height);
  if (ratio) {
    const centerX = start.x + start.width / 2;
    const centerY = start.y + start.height / 2;
    let width = right - left;
    let height = bottom - top;
    if (handle === 'e' || handle === 'w') {
      width = Math.min(width, bounds.height * ratio, handle === 'e' ? bounds.width - start.x : start.x + start.width);
      height = width / ratio;
      if (handle === 'w') left = start.x + start.width - width; else right = start.x + width;
      top = clamp(centerY - height / 2, 0, bounds.height - height);
      bottom = top + height;
      if (handle === 'w') right = left + width; else left = right - width;
    } else if (handle === 'n' || handle === 's') {
      height = Math.min(height, bounds.width / ratio, handle === 's' ? bounds.height - start.y : start.y + start.height);
      width = height * ratio;
      if (handle === 'n') top = start.y + start.height - height; else bottom = start.y + height;
      left = clamp(centerX - width / 2, 0, bounds.width - width);
      right = left + width;
      if (handle === 'n') bottom = top + height; else top = bottom - height;
    } else {
      width = Math.max(width, height * ratio);
      const maxWidth = handle.includes('w') ? start.x + start.width : bounds.width - start.x;
      const maxHeight = handle.includes('n') ? start.y + start.height : bounds.height - start.y;
      width = Math.min(width, maxWidth, maxHeight * ratio);
      height = width / ratio;
      if (handle.includes('w')) left = start.x + start.width - width; else right = start.x + width;
      if (handle.includes('n')) top = start.y + start.height - height; else bottom = start.y + height;
      if (handle.includes('w')) right = start.x + start.width; else left = start.x;
      if (handle.includes('n')) bottom = start.y + start.height; else top = start.y;
    }
  }
  return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, bounds);
};
