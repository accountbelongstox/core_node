/* =============================================================================
 * CapCamera — public, cross-platform CAMERA / PHOTO capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): set a profile avatar, snap a page to OCR/scan vocabulary, or
 *   attach an image to a note. Falls back to an <input type="file"> picker.
 *
 * WHAT IT DOES
 *   - Take a photo (camera), pick one from the gallery, or prompt the user.
 *   - Pick multiple gallery images.
 *   - Permission lifecycle (check / request / ensure).
 *   - Normalized result: every photo comes back with a `dataUrl` ready for an
 *     <img>/<canvas>, plus `base64`, `format`, and (web) a `blob`.
 *   - Helpers: square-crop avatar capture, dataUrl<->Blob, downscale.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/camera (real camera/gallery, native crop).
 *   - Web: an <input type="file"> picker (capture=environment for the camera),
 *     with optional canvas downscale. On the web build the plugin is aliased to
 *     that picker-backed shim.
 *
 * QUICK START
 *   import { capCamera, useCamera } from '@/shared/capabilities/CapCamera';
 *   const photo = await capCamera.takePhoto({ quality: 85 });
 *   img.src = photo.dataUrl;
 *   const avatar = await capCamera.captureAvatar(512);
 *   // React: const { photo, takePhoto, pickPhoto } = useCamera();
 * ========================================================================== */

import { useCallback, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

export { CameraResultType, CameraSource, CameraDirection };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapPhoto {
  /** Always populated: a data: URL ready for <img>/<canvas>. */
  dataUrl: string;
  /** Raw base64 (no data: prefix). */
  base64: string;
  /** Image format, e.g. 'jpeg' | 'png'. */
  format: string;
  /** Web-only Blob (handy for upload). */
  blob?: Blob;
  /** Native path / web object path when available. */
  path?: string;
}

export interface CapPhotoOptions {
  /** JPEG quality 0..100. Default 85. */
  quality?: number;
  /** Allow native crop/edit. Default false. */
  allowEditing?: boolean;
  /** Max width (downscaled). */
  width?: number;
  /** Max height (downscaled). */
  height?: number;
  /** Source: camera, gallery, or prompt. Default prompt. */
  source?: CameraSource;
  /** Front/rear camera (web/iOS). Default rear. */
  direction?: CameraDirection;
  /** Save the captured photo to the device gallery (native). Default false. */
  saveToGallery?: boolean;
}

export interface CapGalleryOptions {
  quality?: number;
  /** Max number of images to pick. */
  limit?: number;
  width?: number;
  height?: number;
}

export type CapCameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Image helpers (exported)
// ---------------------------------------------------------------------------

/** Strip the data: prefix from a data URL, returning raw base64. */
export function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** Detect the image format ('jpeg'/'png'/...) from a data URL. */
export function formatOf(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  return m ? m[1] : 'jpeg';
}

/** Convert a data URL to a Blob (for upload). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg';
  const bin = atob(body || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Downscale + recompress a data URL to fit within maxW x maxH (web only). */
export function downscaleDataUrl(
  dataUrl: string,
  maxW: number,
  maxH: number,
  quality = 0.9,
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Center-crop a data URL to a square of `size` px (web only; great for avatars). */
export function squareCropDataUrl(dataUrl: string, size: number, quality = 0.9): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapCameraService {
  private readonly native = safeIsNative();
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapCamera] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }

  /** Whether photo capture/selection is available at all. */
  isSupported(): boolean {
    if (this.native) return true;
    try {
      return typeof document !== 'undefined';
    } catch {
      return false;
    }
  }

  async checkPermissions(): Promise<{ camera: CapCameraPermission; photos: CapCameraPermission }> {
    try {
      const r: any = await Camera.checkPermissions();
      return { camera: norm(r.camera), photos: norm(r.photos) };
    } catch {
      return { camera: 'unknown', photos: 'unknown' };
    }
  }

  async requestPermissions(): Promise<{ camera: CapCameraPermission; photos: CapCameraPermission }> {
    try {
      const r: any = await Camera.requestPermissions();
      return { camera: norm(r.camera), photos: norm(r.photos) };
    } catch {
      return { camera: 'denied', photos: 'denied' };
    }
  }

  /** Ensure camera permission, prompting if needed. */
  async ensurePermission(): Promise<boolean> {
    const cur = await this.checkPermissions();
    if (cur.camera === 'granted' || cur.photos === 'granted') return true;
    const req = await this.requestPermissions();
    return req.camera === 'granted' || req.photos === 'granted';
  }

  /** Core capture; normalizes the result to a CapPhoto. */
  async getPhoto(options: CapPhotoOptions = {}): Promise<CapPhoto> {
    const result: any = await Camera.getPhoto({
      quality: options.quality ?? 85,
      allowEditing: options.allowEditing ?? false,
      resultType: CameraResultType.DataUrl,
      source: options.source ?? CameraSource.Prompt,
      direction: options.direction ?? CameraDirection.Rear,
      width: options.width,
      height: options.height,
      correctOrientation: true,
      saveToGallery: options.saveToGallery ?? false,
    });
    return this.normalize(result, options);
  }

  /** Take a NEW photo with the camera. */
  takePhoto(options: Omit<CapPhotoOptions, 'source'> = {}): Promise<CapPhoto> {
    return this.getPhoto({ ...options, source: CameraSource.Camera });
  }

  /** Pick an existing photo from the gallery. */
  pickPhoto(options: Omit<CapPhotoOptions, 'source'> = {}): Promise<CapPhoto> {
    return this.getPhoto({ ...options, source: CameraSource.Photos });
  }

  /** Pick multiple images from the gallery. */
  async pickImages(options: CapGalleryOptions = {}): Promise<CapPhoto[]> {
    try {
      const r: any = await Camera.pickImages({
        quality: options.quality ?? 85,
        limit: options.limit,
        width: options.width,
        height: options.height,
      });
      const photos: any[] = r?.photos ?? [];
      const out: CapPhoto[] = [];
      for (const p of photos) out.push(await this.normalizeGallery(p, options));
      return out;
    } catch (e) {
      this.log('pickImages failed', e);
      return [];
    }
  }

  /**
   * Capture or pick an avatar and center-crop it to a square `size`. On web the
   * crop is applied via canvas; on native, allowEditing offers the OS cropper.
   */
  async captureAvatar(size = 512, source: CameraSource = CameraSource.Prompt): Promise<CapPhoto> {
    const photo = await this.getPhoto({ source, allowEditing: true, quality: 90, width: size, height: size });
    const cropped = await squareCropDataUrl(photo.dataUrl, size, 0.9);
    return this.fromDataUrl(cropped, photo.path);
  }

  // -- normalization ------------------------------------------------------- #

  private async normalize(result: any, options: CapPhotoOptions): Promise<CapPhoto> {
    let dataUrl: string =
      result.dataUrl ||
      (result.base64String ? `data:image/${result.format || 'jpeg'};base64,${result.base64String}` : '') ||
      result.webPath ||
      '';
    if (!dataUrl) throw new Error('No image data returned.');
    // If the result is a webPath (uri), fetch it into a data URL for parity.
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http') || dataUrl.startsWith('file:')) {
      dataUrl = await this.urlToDataUrl(dataUrl);
    }
    if (options.width || options.height) {
      dataUrl = await downscaleDataUrl(dataUrl, options.width ?? 4096, options.height ?? 4096, (options.quality ?? 85) / 100);
    }
    return this.fromDataUrl(dataUrl, result.path);
  }

  private async normalizeGallery(p: any, options: CapGalleryOptions): Promise<CapPhoto> {
    let dataUrl: string = p.dataUrl || (p.base64String ? `data:image/${p.format || 'jpeg'};base64,${p.base64String}` : '') || p.webPath || '';
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http') || dataUrl.startsWith('file:')) {
      dataUrl = await this.urlToDataUrl(dataUrl);
    }
    if (options.width || options.height) {
      dataUrl = await downscaleDataUrl(dataUrl, options.width ?? 4096, options.height ?? 4096, (options.quality ?? 85) / 100);
    }
    return this.fromDataUrl(dataUrl, p.path);
  }

  private fromDataUrl(dataUrl: string, path?: string): CapPhoto {
    const base64 = stripDataUrl(dataUrl);
    let blob: Blob | undefined;
    try {
      blob = dataUrlToBlob(dataUrl);
    } catch {
      blob = undefined;
    }
    return { dataUrl, base64, format: formatOf(dataUrl), blob, path };
  }

  private async urlToDataUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }
}

function norm(state: string | undefined): CapCameraPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capCamera = new CapCameraService();
export const takePhoto = (o?: Omit<CapPhotoOptions, 'source'>): Promise<CapPhoto> => capCamera.takePhoto(o);
export const pickPhoto = (o?: Omit<CapPhotoOptions, 'source'>): Promise<CapPhoto> => capCamera.pickPhoto(o);

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseCameraResult {
  photo: CapPhoto | null;
  photos: CapPhoto[];
  loading: boolean;
  error: string | null;
  takePhoto: (o?: Omit<CapPhotoOptions, 'source'>) => Promise<CapPhoto | null>;
  pickPhoto: (o?: Omit<CapPhotoOptions, 'source'>) => Promise<CapPhoto | null>;
  pickImages: (o?: CapGalleryOptions) => Promise<CapPhoto[]>;
  captureAvatar: (size?: number) => Promise<CapPhoto | null>;
  reset: () => void;
}

/**
 * React hook over the shared camera service. Tracks the last photo + errors.
 *
 *   const { photo, takePhoto, pickPhoto } = useCamera();
 *   <button onClick={() => takePhoto()}>📷</button>
 *   {photo && <img src={photo.dataUrl} />}
 */
export function useCamera(): UseCameraResult {
  const [photo, setPhoto] = useState<CapPhoto | null>(null);
  const [photos, setPhotos] = useState<CapPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message || e);
      // User-cancel is not an error worth surfacing loudly.
      if (!/cancel/i.test(msg)) setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const takePhotoCb = useCallback(
    async (o?: Omit<CapPhotoOptions, 'source'>) => {
      const p = await run(() => capCamera.takePhoto(o));
      if (p) setPhoto(p);
      return p;
    },
    [run],
  );
  const pickPhotoCb = useCallback(
    async (o?: Omit<CapPhotoOptions, 'source'>) => {
      const p = await run(() => capCamera.pickPhoto(o));
      if (p) setPhoto(p);
      return p;
    },
    [run],
  );
  const pickImagesCb = useCallback(
    async (o?: CapGalleryOptions) => {
      const ps = (await run(() => capCamera.pickImages(o))) ?? [];
      setPhotos(ps);
      return ps;
    },
    [run],
  );
  const captureAvatarCb = useCallback(
    async (size?: number) => {
      const p = await run(() => capCamera.captureAvatar(size));
      if (p) setPhoto(p);
      return p;
    },
    [run],
  );

  return {
    photo,
    photos,
    loading,
    error,
    takePhoto: takePhotoCb,
    pickPhoto: pickPhotoCb,
    pickImages: pickImagesCb,
    captureAvatar: captureAvatarCb,
    reset: () => {
      setPhoto(null);
      setPhotos([]);
      setError(null);
    },
  };
}

// ===========================================================================
// EXTENDED CAPABILITIES — image processing (thumbnail / scan / rotate)
// ===========================================================================
//
// Canvas-based post-processing for the captured photo: small thumbnails for
// lists, a grayscale + threshold "document scan" filter to make a snapped page
// crisp for OCR, rotation, and dimension probing. All run on the web/WebView
// canvas and degrade to the original data URL when canvas is unavailable.

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** Get the pixel dimensions of an image data URL. */
export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl);
  return img ? { width: img.width, height: img.height } : { width: 0, height: 0 };
}

/** Produce a small square thumbnail (center-cropped) data URL. */
export async function generateThumbnail(dataUrl: string, size = 96, quality = 0.8): Promise<string> {
  const img = await loadImage(dataUrl);
  if (!img) return dataUrl;
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const made = makeCanvas(size, size);
  if (!made) return dataUrl;
  made.ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return made.canvas.toDataURL('image/jpeg', quality);
}

/** Rotate an image data URL by 90/180/270 degrees. */
export async function rotateDataUrl(dataUrl: string, degrees: 90 | 180 | 270): Promise<string> {
  const img = await loadImage(dataUrl);
  if (!img) return dataUrl;
  const swap = degrees === 90 || degrees === 270;
  const made = makeCanvas(swap ? img.height : img.width, swap ? img.width : img.height);
  if (!made) return dataUrl;
  const { ctx, canvas } = made;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Convert to grayscale. */
export async function toGrayscale(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  if (!img) return dataUrl;
  const made = makeCanvas(img.width, img.height);
  if (!made) return dataUrl;
  const { ctx, canvas } = made;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = lum;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export interface CapScanOptions {
  /** Threshold 0..255; pixels brighter become white, darker become black. 0 = auto (mean). */
  threshold?: number;
  /** Contrast multiplier applied before thresholding. Default 1.2. */
  contrast?: number;
}

/**
 * "Document scan" filter: grayscale + contrast + threshold to a crisp black-on-
 * white image that OCR engines read far better. Auto-threshold uses the mean
 * luminance when `threshold` is 0/omitted.
 */
export async function documentScan(dataUrl: string, options: CapScanOptions = {}): Promise<string> {
  const img = await loadImage(dataUrl);
  if (!img) return dataUrl;
  const made = makeCanvas(img.width, img.height);
  if (!made) return dataUrl;
  const { ctx, canvas } = made;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data;
  const contrast = options.contrast ?? 1.2;

  // First pass: grayscale + contrast, and accumulate mean for auto-threshold.
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    let lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    lum = Math.min(255, Math.max(0, (lum - 128) * contrast + 128));
    px[i] = px[i + 1] = px[i + 2] = lum;
    sum += lum;
  }
  const mean = sum / (px.length / 4);
  const threshold = options.threshold && options.threshold > 0 ? options.threshold : mean * 0.95;

  // Second pass: threshold to black/white.
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] >= threshold ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// ---------------------------------------------------------------------------
// Extended service methods (attached as free helpers over the singleton)
// ---------------------------------------------------------------------------

/** Capture (or pick) a page and run the document-scan filter on it. */
export async function scanDocument(
  options: CapPhotoOptions & CapScanOptions = {},
): Promise<CapPhoto> {
  const photo = await capCamera.getPhoto({ ...options, source: options.source ?? CameraSource.Camera, quality: options.quality ?? 92 });
  const scanned = await documentScan(photo.dataUrl, options);
  const base64 = stripDataUrl(scanned);
  let blob: Blob | undefined;
  try {
    blob = dataUrlToBlob(scanned);
  } catch {
    blob = undefined;
  }
  return { dataUrl: scanned, base64, format: formatOf(scanned), blob, path: photo.path };
}

// ---------------------------------------------------------------------------
// Extended React hook
// ---------------------------------------------------------------------------

/**
 * Avatar picker: capture/pick + square-crop, returning the cropped data URL via
 * `onPicked`. Tracks a busy flag for disabling the button.
 *
 *   const { pick, busy } = useAvatarPicker((dataUrl) => setAvatar(dataUrl), 256);
 */
export function useAvatarPicker(
  onPicked: (dataUrl: string, photo: CapPhoto) => void,
  size = 256,
): { pick: (source?: CameraSource) => Promise<void>; busy: boolean; error: string | null } {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cb = useCallback(
    async (source: CameraSource = CameraSource.Prompt) => {
      setBusy(true);
      setError(null);
      try {
        const photo = await capCamera.captureAvatar(size, source);
        onPicked(photo.dataUrl, photo);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (!/cancel/i.test(msg)) setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [onPicked, size],
  );
  return { pick: cb, busy, error };
}

// ===========================================================================
// EXTENDED CAPABILITIES — crop, image stacking, multi-page document scanner
// ===========================================================================
//
// Crop a region, stack several scanned pages into one tall image, and a small
// multi-page document scanner that captures + filters each page and merges them
// into a single export-ready image (e.g. snap a multi-page handout to study).

/**
 * Crop a region from an image data URL. `rect` values are fractions 0..1 of the
 * source dimensions (so it's resolution-independent).
 */
export async function cropDataUrl(
  dataUrl: string,
  rect: { x: number; y: number; w: number; h: number },
  quality = 0.92,
): Promise<string> {
  const img = await loadImage(dataUrl);
  if (!img) return dataUrl;
  const sx = Math.round(rect.x * img.width);
  const sy = Math.round(rect.y * img.height);
  const sw = Math.round(rect.w * img.width);
  const sh = Math.round(rect.h * img.height);
  const made = makeCanvas(Math.max(1, sw), Math.max(1, sh));
  if (!made) return dataUrl;
  made.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return made.canvas.toDataURL('image/jpeg', quality);
}

/** Stack multiple image data URLs vertically into one tall image. */
export async function stackImagesVertically(dataUrls: string[], gap = 12, bg = '#ffffff'): Promise<string> {
  if (dataUrls.length === 0) return '';
  if (dataUrls.length === 1) return dataUrls[0];
  const imgs = (await Promise.all(dataUrls.map((d) => loadImage(d)))).filter(Boolean) as HTMLImageElement[];
  if (!imgs.length) return dataUrls[0];
  const width = Math.max(...imgs.map((i) => i.width));
  const height = imgs.reduce((a, i) => a + i.height, 0) + gap * (imgs.length - 1);
  const made = makeCanvas(width, height);
  if (!made) return dataUrls[0];
  const { ctx, canvas } = made;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const im of imgs) {
    ctx.drawImage(im, Math.round((width - im.width) / 2), y);
    y += im.height + gap;
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Multi-page document scanner: capture page after page (each run through the
 * scan filter), then merge into one tall export-ready image.
 *
 *   const scanner = new CapDocumentScanner();
 *   await scanner.addPage();          // snap page 1
 *   await scanner.addPage();          // snap page 2
 *   const merged = await scanner.merge();
 */
export class CapDocumentScanner {
  private pages: CapPhoto[] = [];

  constructor(private readonly scanOptions: CapScanOptions = {}) {}

  /** Capture a new page (camera) and append the scanned result. */
  async addPage(options: CapPhotoOptions = {}): Promise<CapPhoto> {
    const page = await scanDocument({ ...this.scanOptions, ...options, source: CameraSource.Camera });
    this.pages.push(page);
    return page;
  }

  /** Append an already-captured/processed page. */
  addExisting(photo: CapPhoto): void {
    this.pages.push(photo);
  }

  removePage(index: number): void {
    if (index >= 0 && index < this.pages.length) this.pages.splice(index, 1);
  }
  clear(): void {
    this.pages = [];
  }
  getPages(): CapPhoto[] {
    return this.pages.slice();
  }
  count(): number {
    return this.pages.length;
  }

  /** Merge all pages into a single tall image data URL. */
  async merge(): Promise<string> {
    return stackImagesVertically(this.pages.map((p) => p.dataUrl));
  }
}

/**
 * React hook over a multi-page document scanner.
 *
 *   const { pages, addPage, merge, busy } = useDocumentScanner();
 */
export function useDocumentScanner(scanOptions?: CapScanOptions): {
  pages: CapPhoto[];
  busy: boolean;
  error: string | null;
  addPage: () => Promise<void>;
  removePage: (i: number) => void;
  clear: () => void;
  merge: () => Promise<string>;
} {
  const scannerRef = useRef<CapDocumentScanner | null>(null);
  if (!scannerRef.current) scannerRef.current = new CapDocumentScanner(scanOptions);
  const [pages, setPages] = useState<CapPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPage = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await scannerRef.current!.addPage();
      setPages(scannerRef.current!.getPages());
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    pages,
    busy,
    error,
    addPage,
    removePage: (i: number) => {
      scannerRef.current?.removePage(i);
      setPages(scannerRef.current?.getPages() ?? []);
    },
    clear: () => {
      scannerRef.current?.clear();
      setPages([]);
    },
    merge: () => scannerRef.current?.merge() ?? Promise.resolve(''),
  };
}

export default capCamera;
