/** Shared file helpers for the media workbenches: sizes, names, downloads and object-URL lifetime. */
import { useEffect, useState } from 'react';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];
const BYTES_PER_UNIT = 1024;
const REVOKE_DELAY_MS = 1000;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
};

export const formatBytes = (bytes: number): string => {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${BYTE_UNITS[unit]}`;
};

export const baseName = (fileName: string): string => fileName.replace(/\.[^./\\]+$/, '') || fileName;

export const extensionFor = (mime: string): string => MIME_EXTENSIONS[mime] ?? 'bin';

export const savingsPercent = (before: number, after: number): number =>
  before > 0 ? Math.round((1 - after / before) * 1000) / 10 : 0;

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
};

/** Object URL for a blob that is revoked when the blob changes or the component unmounts. */
export const useObjectUrl = (blob: Blob | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const pickNumber = (source: unknown, key: string, min: number, max: number, fallback: number): number => {
  if (!isRecord(source)) return fallback;
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

export const pickString = <T extends string>(source: unknown, key: string, allowed: readonly T[], fallback: T): T => {
  if (!isRecord(source)) return fallback;
  const value = source[key];
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
};

export const outputFileName = (sourceName: string, suffix: string, mime: string): string =>
  `${baseName(sourceName)}-${suffix}.${extensionFor(mime)}`;
