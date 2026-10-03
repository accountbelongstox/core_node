/** AES-256-GCM text encryption with a PBKDF2-SHA-256 passphrase key; the packed format is self-describing. */
import { concatBytes, fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from './cryptoCore';

export type AesErrorCode = 'invalid_format' | 'decrypt_failed' | 'unsupported_version';

export class AesToolError extends Error {
  constructor(public readonly code: AesErrorCode) {
    super(code);
  }
}

const FORMAT_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = 1 + 4;
const TAG_BYTES = 16;

export const PBKDF2_ITERATION_OPTIONS: readonly number[] = [100_000, 310_000, 600_000];
export const DEFAULT_PBKDF2_ITERATIONS = 310_000;

const deriveKey = async (passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey('raw', utf8Encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

/** Packs Base64( version | iterations(u32 BE) | salt(16) | iv(12) | ciphertext+tag ). */
export const encryptText = async (plaintext: string, passphrase: string, iterations: number): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, iterations);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8Encode(plaintext)));
  const header = new Uint8Array(HEADER_BYTES);
  header[0] = FORMAT_VERSION;
  new DataView(header.buffer).setUint32(1, iterations);
  return toBase64(concatBytes(header, salt, iv, sealed));
};

export const decryptText = async (packed: string, passphrase: string): Promise<string> => {
  const bytes = fromBase64(packed);
  if (!bytes || bytes.length < HEADER_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES) throw new AesToolError('invalid_format');
  if (bytes[0] !== FORMAT_VERSION) throw new AesToolError('unsupported_version');
  const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(1);
  if (iterations < 1 || iterations > 10_000_000) throw new AesToolError('invalid_format');
  const salt = bytes.slice(HEADER_BYTES, HEADER_BYTES + SALT_BYTES);
  const iv = bytes.slice(HEADER_BYTES + SALT_BYTES, HEADER_BYTES + SALT_BYTES + IV_BYTES);
  const sealed = bytes.slice(HEADER_BYTES + SALT_BYTES + IV_BYTES);
  try {
    const key = await deriveKey(passphrase, salt, iterations);
    return utf8Decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed)));
  } catch {
    throw new AesToolError('decrypt_failed');
  }
};
