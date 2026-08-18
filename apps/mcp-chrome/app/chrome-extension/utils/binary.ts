const BASE64_CHUNK_SIZE = 0x8000;

export type ByteSequence = number[] | Uint8Array;

export function bytesToBase64(bytes: ByteSequence): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.slice(index, index + BASE64_CHUNK_SIZE));
  }

  return btoa(binary);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

export function base64ToBytes(base64: string): Uint8Array {
  let binary: string;

  try {
    binary = atob(base64);
  } catch {
    throw new Error('Invalid base64 data');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
