/** Image intake for the image workbenches: file picker, drop and paste feed one decoded source with managed object URLs. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isImageFile, loadImage, resizeImage } from '@/core/media/ImageOps';

const PREVIEW_MAX_SIDE = 1600;

export interface ImageSource {
  file: File;
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  /** Downscaled stand-in for live previews (the image itself when already small). */
  preview: HTMLImageElement | HTMLCanvasElement;
}

export interface ImageSourceState {
  source: ImageSource | null;
  loading: boolean;
  /** Error code under toolsMedia.errors. */
  error: string | null;
  load: (file: File) => Promise<void>;
  clear: () => void;
  pasteFromClipboard: () => Promise<void>;
}

const clipboardImage = (data: DataTransfer | null): File | null =>
  Array.from(data?.files ?? []).find((file) => file.type.startsWith('image/')) ?? null;

export const useImageSource = (): ImageSourceState => {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const seq = useRef(0);

  const release = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const load = useCallback(async (file: File) => {
    if (!isImageFile(file)) {
      setError('not_image');
      return;
    }
    const id = ++seq.current;
    const url = URL.createObjectURL(file);
    setLoading(true);
    setError(null);
    try {
      const image = await loadImage(url);
      if (id !== seq.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(width, height));
      const preview = scale < 1 ? resizeImage(image, width * scale, height * scale) : image;
      release();
      urlRef.current = url;
      setSource({ file, url, image, width, height, preview });
    } catch (err) {
      URL.revokeObjectURL(url);
      if (id === seq.current) setError(err instanceof Error && err.message === 'image_decode_failed' ? 'decode_failed' : 'too_large');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [release]);

  const clear = useCallback(() => {
    seq.current += 1;
    release();
    setSource(null);
    setError(null);
    setLoading(false);
  }, [release]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await load(new File([blob], `pasted.${type.split('/')[1] ?? 'png'}`, { type }));
          return;
        }
      }
      setError('clipboard_empty');
    } catch {
      setError('clipboard_denied');
    }
  }, [load]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = clipboardImage(event.clipboardData);
      if (file) {
        event.preventDefault();
        void load(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [load]);

  useEffect(() => () => {
    seq.current += 1;
    release();
  }, [release]);

  return { source, loading, error, load, clear, pasteFromClipboard };
};
