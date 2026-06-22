/**
 * Image Compression Helper
 *
 * Shrinks user-picked avatar images on the client BEFORE they are uploaded so
 * the payload can never explode (a raw camera photo can be 20+ MB). This is
 * aligned with the backend avatar contract:
 *   - longest side capped at 512px (aspect ratio preserved)
 *   - re-encoded to JPEG at ~0.85 quality (PNG kept only for images with alpha)
 *   - resulting base64 stays well under ~300 KB in practice
 *   - hard defensive reject at 5 MB (matches the backend pre-decode hard cap)
 *
 * English-only, typed, no side effects beyond producing a smaller image.
 */

/** Longest-side pixel cap for avatars (matches backend max 512x512). */
export const AVATAR_MAX_DIMENSION = 512;

/** Default re-encode quality for lossy (JPEG) output. */
export const AVATAR_ENCODE_QUALITY = 0.85;

/**
 * Defensive hard cap on the *decoded* output size, aligned with the backend
 * 5 MB pre-decode hard cap. If a compressed image somehow still exceeds this,
 * we treat it as a failure rather than sending it.
 */
export const AVATAR_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

/**
 * Soft target: avatars should comfortably land under this. Used only for
 * progressive quality back-off; not a hard error.
 */
const AVATAR_TARGET_BYTES = 300 * 1024;

export interface CompressedImage {
  /** A re-encoded, downscaled File ready to upload via FormData. */
  file: File;
  /** Full data URL (e.g. "data:image/jpeg;base64,...") for preview + base64 upload. */
  dataUrl: string;
  /** Bare base64 string without the "data:...;base64," prefix. */
  base64: string;
  /** MIME type of the produced image. */
  mimeType: string;
  /** Approximate decoded byte size of the produced image. */
  byteSize: number;
  width: number;
  height: number;
}

/** Rough decoded byte size of a base64 data URL payload. */
function dataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  const b64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  // 4 base64 chars -> 3 bytes; subtract padding.
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode the selected image.'));
    img.src = objectUrl;
  });
}

/**
 * Downscale + re-encode an image so its longest side is <= AVATAR_MAX_DIMENSION
 * and its base64 stays small. The aspect ratio is always preserved.
 *
 * Throws if the file is not an image, cannot be decoded, or the compressed
 * result still exceeds the defensive 5 MB hard cap.
 */
export async function compressAvatarImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  const objectUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error('Selected image has no usable dimensions.');
  }

  // Scale so the longest side is at most AVATAR_MAX_DIMENSION; never upscale.
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable for image compression.');
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // PNG (and other alpha formats) keep PNG to preserve transparency; everything
  // else is re-encoded to JPEG which compresses photographic avatars far better.
  const keepPng = file.type === 'image/png';
  const mimeType = keepPng ? 'image/png' : 'image/jpeg';

  let quality = AVATAR_ENCODE_QUALITY;
  let dataUrl = canvas.toDataURL(mimeType, quality);

  // Progressive quality back-off for JPEG so even very dense images land near
  // the soft target without ever exceeding the hard cap.
  if (!keepPng) {
    for (let i = 0; i < 4 && dataUrlByteSize(dataUrl) > AVATAR_TARGET_BYTES; i++) {
      quality = Math.max(0.5, quality - 0.12);
      dataUrl = canvas.toDataURL(mimeType, quality);
    }
  }

  const byteSize = dataUrlByteSize(dataUrl);
  if (byteSize > AVATAR_MAX_OUTPUT_BYTES) {
    throw new Error('Image is still too large after compression. Please choose a smaller image.');
  }

  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode the compressed image.'))),
      mimeType,
      quality,
    );
  });

  const baseName = (file.name || 'avatar').replace(/\.[^.]+$/, '');
  const ext = keepPng ? 'png' : 'jpg';
  const compressedFile = new File([blob], `${baseName}.${ext}`, { type: mimeType });

  return {
    file: compressedFile,
    dataUrl,
    base64,
    mimeType,
    byteSize,
    width: targetW,
    height: targetH,
  };
}

/**
 * Same as compressAvatarImage but accepts an existing data URL / base64 image
 * (e.g. a generated avatar). Used to defensively shrink non-file avatar
 * sources before they are sent as avatar_base64.
 */
export async function compressAvatarDataUrl(
  dataUrl: string,
  fileName = 'avatar',
): Promise<CompressedImage> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  return compressAvatarImage(file);
}
