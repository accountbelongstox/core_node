/** MIME sniffing and extension helpers for the Base64 file workbenches. */
import { bytesToUtf8 } from './convertCodecs';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const TEXT_PREVIEW_CHARS = 4000;
export const DISPLAY_CHARS = 60000;

const SIGNATURES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/bmp', offset: 0, bytes: [0x42, 0x4d] },
  { mime: 'image/x-icon', offset: 0, bytes: [0x00, 0x00, 0x01, 0x00] },
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/gzip', offset: 0, bytes: [0x1f, 0x8b] },
  { mime: 'application/x-7z-compressed', offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0x49, 0x44, 0x33] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0xff, 0xfb] },
  { mime: 'audio/ogg', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mime: 'video/mp4', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { mime: 'video/webm', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf', 'application/zip': 'zip', 'application/gzip': 'gz', 'application/x-7z-compressed': '7z', 'application/json': 'json',
  'application/xml': 'xml', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm', 'text/plain': 'txt',
  'text/html': 'html', 'text/css': 'css', 'text/csv': 'csv', 'application/octet-stream': 'bin',
};

const matches = (bytes: Uint8Array, offset: number, signature: number[]): boolean => signature.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, start: number, end: number): string => String.fromCharCode(...bytes.subarray(start, end));

export const decodeTextBytes = (bytes: Uint8Array): string | null => {
  const sample = bytes.subarray(0, 8192);
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i];
    if (byte < 9 || (byte > 13 && byte < 32 && byte !== 27)) return null;
  }
  try {
    return bytesToUtf8(bytes);
  } catch {
    return null;
  }
};

export const sniffMime = (bytes: Uint8Array): string => {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF') {
    const kind = ascii(bytes, 8, 12);
    if (kind === 'WEBP') return 'image/webp';
    if (kind === 'WAVE') return 'audio/wav';
  }
  const signature = SIGNATURES.find((entry) => matches(bytes, entry.offset, entry.bytes));
  if (signature) return signature.mime;
  const text = decodeTextBytes(bytes);
  if (text === null) return 'application/octet-stream';
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  if (head.startsWith('<?xml')) return 'application/xml';
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'text/html';
  if (head.startsWith('{') || head.startsWith('[')) {
    try {
      JSON.parse(text);
      return 'application/json';
    } catch {
      return 'text/plain';
    }
  }
  return 'text/plain';
};

export const extensionForMime = (mime: string): string => EXTENSIONS[mime] ?? (mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin');

export const parseDataUri = (input: string): { mime: string; payload: string } => {
  const match = /^\s*data:([^;,]*)((?:;[^;,=]+=[^;,]*)*)(;base64)?,/i.exec(input);
  if (!match) return { mime: '', payload: input };
  return { mime: match[1].toLowerCase(), payload: input.slice(match[0].length) };
};

export const readFileBytes = async (file: File): Promise<Uint8Array> => new Uint8Array(await file.arrayBuffer());
