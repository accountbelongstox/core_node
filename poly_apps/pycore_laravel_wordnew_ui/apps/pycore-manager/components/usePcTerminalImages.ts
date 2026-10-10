import { useCallback, useEffect, useRef, useState } from 'react';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import { RELAY_CONTRACT } from '@/core/contracts/RelayContract';
import { compressImageFile, type ImageCompressPolicy } from '@/core/media/ImageProcessor';
import { recognizeImageText, textRecognitionErrorCode, textRecognitionSupported } from '@/shared/ocr/CapTextRecognition';

export type PcTerminalImageStatus = 'queued' | 'compressing' | 'uploading' | 'uploaded' | 'error';

export type PcTerminalAttachmentKind = 'image' | 'audio' | 'file';

export type PcTerminalImageOcrStatus = 'running' | 'done' | 'empty' | 'error';

/** On-device text recognition of an attached image, independent of its upload. */
export interface PcTerminalImageOcr {
  status: PcTerminalImageOcrStatus;
  text: string;
  errorCode: string;
}

export interface PcTerminalImage {
  id: string;
  windowId: string;
  kind: PcTerminalAttachmentKind;
  file: File;
  previewUrl: string;
  status: PcTerminalImageStatus;
  progress: number;
  displayPath: string;
  /** Size pycore stored, known once the upload finished. */
  storedBytes: number | null;
  /** Set when pycore compressed the image on receipt; the original was discarded. */
  compression: PcTerminalImageCompression | null;
  errorKey: string;
  errorParams: Record<string, number>;
  errorDetail: PcTerminalImageErrorDetail | null;
  /** Set only for images in the Android app, where recognition runs on the device. */
  ocr?: PcTerminalImageOcr;
}

export interface PcTerminalImageCompression {
  originalBytes: number;
  originalWidth: number;
  originalHeight: number;
  bytes: number;
  width: number;
  height: number;
}

/** Everything known about a failed upload, shown in full under the attachments. */
export interface PcTerminalImageErrorDetail {
  code: string;
  httpStatus: number | null;
  message: string;
  receivedBytes: number | null;
  headHex: string;
  maxBytes: number | null;
}

export interface PcTerminalImages {
  items: PcTerminalImage[];
  busy: boolean;
  addFiles: (files: File[]) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  clear: () => void;
  /** Uploads every attachment of the window: the uploaded ones in attach order plus the count that failed. */
  uploadAll: () => Promise<PcTerminalUploadResult>;
}

export interface PcTerminalUploaded {
  kind: PcTerminalAttachmentKind;
  displayPath: string;
}

export interface PcTerminalUploadResult {
  uploaded: PcTerminalUploaded[];
  failedCount: number;
}

const IMAGE_MIME = /^image\//i;
/** Same targets pycore applies on receipt: images are compressed on the device before they are uploaded. */
const UPLOAD_COMPRESS_POLICY: ImageCompressPolicy = {
  maxShortSide: RELAY_CONTRACT.limits.terminal_image_compress_short_side,
  maxBytes: RELAY_CONTRACT.limits.terminal_image_compress_bytes,
};
const AUDIO_MIME = /^audio\//i;
/** System recorders may hand over a recording without a type; its extension decides. */
const AUDIO_EXTENSION = /\.(m4a|aac|amr|3gp|3gpp|ogg|oga|opus|webm|wav|mp3|flac)$/i;
/** Files of any other format travel as they are (no compression, no recognition); pycore stores them next to the images. */
/** `accept` of the document picker: every format. */
export const TERMINAL_DOCUMENT_ACCEPT = '*/*';
const MIB = 1024 * 1024;
const ERROR_KEYS = {
  notImage: 'terminal.images.notImage',
  failed: 'terminal.images.uploadFailed',
  stalled: 'terminal.images.uploadStalled',
} as const;
/** pycore `error_code` of ui/terminal/image/upload -> locale key. */
const UPLOAD_ERROR_KEYS: Record<string, string> = {
  terminal_image_missing: 'terminal.images.errors.missing',
  terminal_image_too_large: 'terminal.images.errors.tooLarge',
  terminal_image_unsupported_type: 'terminal.images.errors.unsupportedType',
  terminal_image_read_failed: 'terminal.images.errors.readFailed',
  terminal_image_write_failed: 'terminal.images.errors.writeFailed',
  terminal_document_unsupported_type: 'terminal.images.errors.documentUnsupported',
};

const IMAGE_PLACEHOLDER = /\[Image #\d+\]/gi;

/** Rich-paste artefacts of image tags never reach the terminal: images travel only as path text. */
export function stripImagePlaceholders(text: string): string {
  return text.replace(IMAGE_PLACEHOLDER, '').replace(/[ \t]{2,}/g, ' ').trim();
}

export function isTerminalImageFile(file: File): boolean {
  return IMAGE_MIME.test(file.type);
}

export function isTerminalAudioFile(file: File): boolean {
  return AUDIO_MIME.test(file.type) || (!file.type && AUDIO_EXTENSION.test(file.name));
}

export function isTerminalDocumentFile(file: File): boolean {
  return !isTerminalImageFile(file) && !isTerminalAudioFile(file);
}

/** Every file format can be attached. */
export function isTerminalAttachmentFile(file: File): boolean {
  return file instanceof Blob;
}

function attachmentKindOf(file: File): PcTerminalAttachmentKind {
  if (isTerminalAudioFile(file)) return 'audio';
  return isTerminalDocumentFile(file) ? 'file' : 'image';
}

export function usePcTerminalImages(windowId: string | undefined): PcTerminalImages {
  const terminalApi = usePcTerminalApi();
  const [all, setAll] = useState<PcTerminalImage[]>([]);
  const allRef = useRef<PcTerminalImage[]>([]);
  const aborts = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const flights = useRef(new Map<string, Promise<string | null>>());

  const commit = useCallback((next: PcTerminalImage[]) => {
    allRef.current = next;
    setAll(next);
  }, []);

  const patch = useCallback((id: string, change: Partial<PcTerminalImage>) => {
    commit(allRef.current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, [commit]);

  const release = useCallback((item: PcTerminalImage) => {
    aborts.current.get(item.id)?.abort();
    aborts.current.delete(item.id);
    flights.current.delete(item.id);
    URL.revokeObjectURL(item.previewUrl);
  }, []);

  useEffect(() => () => allRef.current.forEach(release), [release]);

  /** Recognizes the text of the image as it was attached; the result is dropped when the image was removed meanwhile. */
  const recognize = useCallback(async (item: PcTerminalImage) => {
    patch(item.id, { ocr: { status: 'running', text: '', errorCode: '' } });
    let ocr: PcTerminalImageOcr;
    try {
      const text = (await recognizeImageText(item.file)).text.trim();
      ocr = { status: text ? 'done' : 'empty', text, errorCode: '' };
    } catch (error) {
      ocr = { status: 'error', text: '', errorCode: textRecognitionErrorCode(error) };
    }
    if (allRef.current.some((entry) => entry.id === item.id)) patch(item.id, { ocr });
  }, [patch]);

  const addFiles = useCallback((files: File[]) => {
    if (!windowId) return;
    const added = files.map((file): PcTerminalImage => {
      counter.current += 1;
      const ok = isTerminalAttachmentFile(file);
      return {
        id: `img-${counter.current}`,
        windowId,
        kind: attachmentKindOf(file),
        file,
        previewUrl: ok && !isTerminalDocumentFile(file) ? URL.createObjectURL(file) : '',
        status: ok ? 'queued' : 'error',
        progress: 0,
        displayPath: '',
        storedBytes: null,
        compression: null,
        errorKey: ok ? '' : ERROR_KEYS.notImage,
        errorParams: {},
        errorDetail: null,
      };
    });
    if (!added.length) return;
    commit([...allRef.current, ...added]);
    if (textRecognitionSupported()) added.forEach((item) => { if (item.kind === 'image' && item.previewUrl) void recognize(item); });
  }, [commit, recognize, windowId]);

  const remove = useCallback((id: string) => {
    const item = allRef.current.find((entry) => entry.id === id);
    if (item) release(item);
    commit(allRef.current.filter((entry) => entry.id !== id));
  }, [commit, release]);

  const clear = useCallback(() => {
    const keep: PcTerminalImage[] = [];
    allRef.current.forEach((item) => {
      if (item.windowId === windowId) release(item);
      else keep.push(item);
    });
    commit(keep);
  }, [commit, release, windowId]);

  const startUpload = useCallback(async (item: PcTerminalImage): Promise<string | null> => {
    const abort = new AbortController();
    aborts.current.set(item.id, abort);
    patch(item.id, { status: item.kind === 'image' ? 'compressing' : 'uploading', progress: 0, errorKey: '', errorParams: {}, errorDetail: null });
    try {
      // A file the device cannot decode (rare raw variants) goes as it is; pycore compresses it on receipt.
      const local = item.kind === 'image' ? await compressImageFile(item.file, UPLOAD_COMPRESS_POLICY) : null;
      if (abort.signal.aborted) return null;
      const localPreview = local?.compressed ? URL.createObjectURL(local.file) : '';
      if (localPreview) URL.revokeObjectURL(item.previewUrl);
      patch(item.id, {
        status: 'uploading',
        // The original is dropped once compressed: a retry or resend uses the compressed file.
        ...(localPreview ? {
          file: local!.file,
          previewUrl: localPreview,
          compression: {
            originalBytes: local!.original.bytes,
            originalWidth: local!.original.width,
            originalHeight: local!.original.height,
            bytes: local!.result.bytes,
            width: local!.result.width,
            height: local!.result.height,
          },
        } : {}),
      });
      const result = await terminalApi.uploadTerminalImage(item.windowId, local?.file ?? item.file, {
        signal: abort.signal,
        onProgress: (fraction) => patch(item.id, { progress: fraction }),
      });
      if (!result?.success || !result.display_path) {
        patch(item.id, {
          status: 'error',
          errorKey: UPLOAD_ERROR_KEYS[result?.error_code ?? ''] ?? ERROR_KEYS.failed,
          errorParams: result?.max_bytes ? { max: Math.round(result.max_bytes / MIB) } : {},
          errorDetail: {
            code: result?.error_code || (result ? 'no_display_path' : 'empty_response'),
            httpStatus: 200,
            message: result?.error ?? '',
            receivedBytes: result?.received_bytes ?? null,
            headHex: result?.head_hex ?? '',
            maxBytes: result?.max_bytes ?? null,
          },
        });
        return null;
      }
      const compressed = Boolean(result.compressed && result.preview_url);
      if (compressed) URL.revokeObjectURL(allRef.current.find((entry) => entry.id === item.id)?.previewUrl ?? item.previewUrl);
      patch(item.id, {
        status: 'uploaded',
        progress: 1,
        displayPath: result.display_path,
        storedBytes: typeof result.bytes === 'number' ? result.bytes : null,
        ...(compressed ? {
          previewUrl: result.preview_url,
          compression: {
            originalBytes: result.original_bytes ?? item.file.size,
            originalWidth: result.original_width ?? 0,
            originalHeight: result.original_height ?? 0,
            bytes: result.bytes ?? 0,
            width: result.width ?? 0,
            height: result.height ?? 0,
          },
        } : {}),
      });
      return result.display_path;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        patch(item.id, {
          status: 'error',
          errorKey: error?.name === 'TimeoutError' ? ERROR_KEYS.stalled : ERROR_KEYS.failed,
          errorDetail: {
            code: [error?.name, error?.code].filter(Boolean).join(' ') || 'request_failed',
            httpStatus: typeof error?.status === 'number' ? error.status : null,
            message: error?.message || String(error),
            receivedBytes: null,
            headHex: '',
            maxBytes: null,
          },
        });
      }
      return null;
    } finally {
      aborts.current.delete(item.id);
      flights.current.delete(item.id);
    }
  }, [patch]);

  /** One upload per image at a time: a retry and a send share the flight in progress. */
  const uploadOne = useCallback((item: PcTerminalImage): Promise<string | null> => {
    if (item.status === 'uploaded') return Promise.resolve(item.displayPath);
    if (!isTerminalAttachmentFile(item.file)) return Promise.resolve(null);
    const running = flights.current.get(item.id);
    if (running) return running;
    const flight = startUpload(item);
    flights.current.set(item.id, flight);
    return flight;
  }, [startUpload]);

  const uploadAll = useCallback(async (): Promise<PcTerminalUploadResult> => {
    const uploaded: PcTerminalUploaded[] = [];
    let failedCount = 0;
    for (const item of allRef.current.filter((entry) => entry.windowId === windowId)) {
      const path = await uploadOne(item);
      // An image removed while its upload ran is no longer part of the message.
      if (!allRef.current.some((entry) => entry.id === item.id)) continue;
      if (path === null) failedCount += 1;
      else uploaded.push({ kind: item.kind, displayPath: path });
    }
    return { uploaded, failedCount };
  }, [uploadOne, windowId]);

  const retry = useCallback((id: string) => {
    const item = allRef.current.find((entry) => entry.id === id);
    if (item) void uploadOne(item);
  }, [uploadOne]);

  // Every attachment uploads as soon as it is added; the send only waits for the uploads still running.
  useEffect(() => {
    all.forEach((item) => {
      if (item.status === 'queued') void uploadOne(item);
    });
  }, [all, uploadOne]);

  const items = all.filter((item) => item.windowId === windowId);
  return {
    items,
    busy: items.some((item) => item.status === 'uploading' || item.status === 'compressing'),
    addFiles,
    remove,
    retry,
    clear,
    uploadAll,
  };
}
