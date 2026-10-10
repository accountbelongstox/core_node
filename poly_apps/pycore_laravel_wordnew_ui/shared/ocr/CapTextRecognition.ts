/* =============================================================================
 * CapTextRecognition - on-device text recognition (OCR) of the Android app
 * =============================================================================
 * Native (Android, app plugin `TextRecognition`): Google ML Kit text recognition v2 (Chinese recognizer, reads
 * Latin too) running on the phone, with the model delivered by Google Play services. The image is re-encoded
 * upright and size-limited here first, so the plugin never has to honor EXIF. Web / desktop: unsupported.
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from '../../core/network/NativeShell';
import { isDesktopAppShell } from '../../core/network/DesktopShell';
import { decodeImage, encodeWithin, fitDimensions } from '../../core/media/ImageProcessor';

export interface CapTextRecognitionBlock {
  text: string;
}

export interface CapTextRecognitionResult {
  text: string;
  blocks: CapTextRecognitionBlock[];
}

export type CapTextRecognitionErrorCode =
  | 'UNSUPPORTED' | 'UNIMPLEMENTED' | 'INVALID_REQUEST' | 'DECODE_FAILED' | 'RECOGNITION_FAILED' | 'MODEL_UNAVAILABLE';

interface TextRecognitionPlugin {
  recognize(options: { base64: string }): Promise<CapTextRecognitionResult>;
}

const RECOGNITION_MAX_LONG_SIDE = 2560;
const RECOGNITION_MAX_BYTES = 4 * 1024 * 1024;
const RECOGNITION_QUALITIES = [0.9, 0.8, 0.7] as const;

const nativeRecognition = registerPlugin<TextRecognitionPlugin>('TextRecognition');

/** The Android app shell: the only place the on-device recognizer exists. */
export function textRecognitionSupported(): boolean {
  return isNativeAppShell() && !isDesktopAppShell();
}

export function textRecognitionErrorCode(error: unknown): CapTextRecognitionErrorCode {
  const code = (error as { code?: string } | null)?.code;
  return (typeof code === 'string' ? code : 'RECOGNITION_FAILED') as CapTextRecognitionErrorCode;
}

function codedError(code: CapTextRecognitionErrorCode, message: string): Error & { code: CapTextRecognitionErrorCode } {
  return Object.assign(new Error(message), { code });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/** Upright JPEG of the image within the recognizer's size budget. */
async function recognitionJpeg(blob: Blob): Promise<Blob> {
  const image = await decodeImage(blob);
  if (!image) throw codedError('DECODE_FAILED', 'The image could not be decoded.');
  try {
    const encoded = await encodeWithin(
      image,
      fitDimensions(image, { maxLongSide: RECOGNITION_MAX_LONG_SIDE }),
      { maxBytes: RECOGNITION_MAX_BYTES, qualities: RECOGNITION_QUALITIES },
    );
    if (!encoded) throw codedError('DECODE_FAILED', 'The image could not be encoded.');
    return encoded.blob;
  } finally {
    image.release();
  }
}

export async function recognizeImageText(blob: Blob): Promise<CapTextRecognitionResult> {
  if (!textRecognitionSupported()) throw codedError('UNSUPPORTED', 'Text recognition is only available in the Android app.');
  const base64 = await blobToBase64(await recognitionJpeg(blob));
  return nativeRecognition.recognize({ base64 });
}
