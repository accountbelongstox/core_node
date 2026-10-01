import { useCallback, useEffect, useRef, useState } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore';

export type PcTerminalImageStatus = 'queued' | 'uploading' | 'uploaded' | 'error';

export interface PcTerminalImage {
  id: string;
  windowId: string;
  file: File;
  previewUrl: string;
  status: PcTerminalImageStatus;
  progress: number;
  displayPath: string;
  errorKey: string;
  errorParams: Record<string, number>;
}

export interface PcTerminalImages {
  items: PcTerminalImage[];
  busy: boolean;
  addFiles: (files: File[]) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  clear: () => void;
  /** Uploads every attached image of the window and returns the display paths in attach order; null when one failed. */
  uploadAll: () => Promise<string[] | null>;
}

const IMAGE_MIME = /^image\//i;
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
};

const IMAGE_PLACEHOLDER = /\[Image #\d+\]/gi;

/** Rich-paste artefacts of image tags never reach the terminal: images travel only as path text. */
export function stripImagePlaceholders(text: string): string {
  return text.replace(IMAGE_PLACEHOLDER, '').replace(/[ \t]{2,}/g, ' ').trim();
}

export function isTerminalImageFile(file: File): boolean {
  return IMAGE_MIME.test(file.type);
}

export function usePcTerminalImages(windowId: string | undefined): PcTerminalImages {
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

  const addFiles = useCallback((files: File[]) => {
    if (!windowId) return;
    const added = files.map((file): PcTerminalImage => {
      counter.current += 1;
      const ok = isTerminalImageFile(file);
      return {
        id: `img-${counter.current}`,
        windowId,
        file,
        previewUrl: ok ? URL.createObjectURL(file) : '',
        status: ok ? 'queued' : 'error',
        progress: 0,
        displayPath: '',
        errorKey: ok ? '' : ERROR_KEYS.notImage,
        errorParams: {},
      };
    });
    if (added.length) commit([...allRef.current, ...added]);
  }, [commit, windowId]);

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
    patch(item.id, { status: 'uploading', progress: 0, errorKey: '', errorParams: {} });
    try {
      const result = await pycoreApi.uploadTerminalImage(item.windowId, item.file, {
        signal: abort.signal,
        onProgress: (fraction) => patch(item.id, { progress: fraction }),
      });
      if (!result?.success || !result.display_path) {
        patch(item.id, {
          status: 'error',
          errorKey: UPLOAD_ERROR_KEYS[result?.error_code ?? ''] ?? ERROR_KEYS.failed,
          errorParams: result?.max_bytes ? { max: Math.round(result.max_bytes / MIB) } : {},
        });
        return null;
      }
      patch(item.id, { status: 'uploaded', progress: 1, displayPath: result.display_path });
      return result.display_path;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        patch(item.id, {
          status: 'error',
          errorKey: error?.name === 'TimeoutError' ? ERROR_KEYS.stalled : ERROR_KEYS.failed,
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
    if (!isTerminalImageFile(item.file)) return Promise.resolve(null);
    const running = flights.current.get(item.id);
    if (running) return running;
    const flight = startUpload(item);
    flights.current.set(item.id, flight);
    return flight;
  }, [startUpload]);

  const uploadAll = useCallback(async (): Promise<string[] | null> => {
    const paths: string[] = [];
    for (const item of allRef.current.filter((entry) => entry.windowId === windowId)) {
      const path = await uploadOne(item);
      // An image removed while its upload ran is no longer part of the message.
      if (!allRef.current.some((entry) => entry.id === item.id)) continue;
      if (path === null) return null;
      paths.push(path);
    }
    return paths;
  }, [uploadOne, windowId]);

  const retry = useCallback((id: string) => {
    const item = allRef.current.find((entry) => entry.id === id);
    if (item) void uploadOne(item);
  }, [uploadOne]);

  const items = all.filter((item) => item.windowId === windowId);
  return {
    items,
    busy: items.some((item) => item.status === 'uploading'),
    addFiles,
    remove,
    retry,
    clear,
    uploadAll,
  };
}
