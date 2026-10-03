/** RSA key pair generation (Web Crypto) with PEM / PKCS#1 / JWK / OpenSSH export and fingerprints. */
import { concatBytes, digest, fromBase64, toBase64, toHex, utf8Encode } from './cryptoCore';

export type RsaKeyFormat = 'pkcs8' | 'pkcs1' | 'jwk';

export interface RsaKeyMaterial {
  privateKey: string;
  publicKey: string;
  openssh: string;
  fingerprintHex: string;
  fingerprintSsh: string;
  modulusBits: number;
}

export const RSA_KEY_SIZES: readonly number[] = [1024, 2048, 3072, 4096];
export const RSA_WEAK_SIZE = 2048;

const PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);
const PEM_LINE = 64;
const DER_SEQUENCE = 0x30;
const DER_OCTET_STRING = 0x04;
const DER_BIT_STRING = 0x03;
const SSH_RSA = 'ssh-rsa';

interface DerNode {
  tag: number;
  contentStart: number;
  contentEnd: number;
}

const readDer = (bytes: Uint8Array, offset: number): DerNode => {
  const tag = bytes[offset];
  let length = bytes[offset + 1];
  let cursor = offset + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + bytes[cursor++];
  }
  return { tag, contentStart: cursor, contentEnd: cursor + length };
};

const pemWrap = (label: string, der: Uint8Array): string => {
  const lines = toBase64(der).match(new RegExp(`.{1,${PEM_LINE}}`, 'g')) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
};

const unwrapPrivateKeyPkcs1 = (pkcs8: Uint8Array): Uint8Array => {
  const outer = readDer(pkcs8, 0);
  const version = readDer(pkcs8, outer.contentStart);
  const algorithm = readDer(pkcs8, version.contentEnd);
  const octets = readDer(pkcs8, algorithm.contentEnd);
  return pkcs8.slice(octets.contentStart, octets.contentEnd);
};

const unwrapPublicKeyPkcs1 = (spki: Uint8Array): Uint8Array => {
  const outer = readDer(spki, 0);
  const algorithm = readDer(spki, outer.contentStart);
  const bits = readDer(spki, algorithm.contentEnd);
  return spki.slice(bits.contentStart + 1, bits.contentEnd);
};

const base64UrlToBytes = (value: string): Uint8Array => fromBase64(value) ?? new Uint8Array(0);

const sshString = (data: Uint8Array): Uint8Array => {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  return concatBytes(length, data);
};

const sshMpint = (data: Uint8Array): Uint8Array => {
  let start = 0;
  while (start < data.length - 1 && data[start] === 0) start++;
  const trimmed = data.slice(start);
  return sshString(trimmed[0] & 0x80 ? concatBytes(new Uint8Array([0]), trimmed) : trimmed);
};

const sshPublicBlob = (jwk: JsonWebKey): Uint8Array => concatBytes(
  sshString(utf8Encode(SSH_RSA)),
  sshMpint(base64UrlToBytes(jwk.e ?? '')),
  sshMpint(base64UrlToBytes(jwk.n ?? '')),
);

export const generateRsaKeyPair = async (modulusBits: number, format: RsaKeyFormat): Promise<RsaKeyMaterial> => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: modulusBits, publicExponent: PUBLIC_EXPONENT, hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const blob = sshPublicBlob(publicJwk);
  let privateKey: string;
  let publicKey: string;
  if (format === 'jwk') {
    privateKey = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey), null, 2);
    publicKey = JSON.stringify(publicJwk, null, 2);
  } else if (format === 'pkcs1') {
    privateKey = pemWrap('RSA PRIVATE KEY', unwrapPrivateKeyPkcs1(pkcs8));
    publicKey = pemWrap('RSA PUBLIC KEY', unwrapPublicKeyPkcs1(spki));
  } else {
    privateKey = pemWrap('PRIVATE KEY', pkcs8);
    publicKey = pemWrap('PUBLIC KEY', spki);
  }
  return {
    privateKey,
    publicKey,
    openssh: `${SSH_RSA} ${toBase64(blob)}`,
    fingerprintHex: toHex(await digest('SHA-256', spki)),
    fingerprintSsh: `SHA256:${toBase64(await digest('SHA-256', blob)).replace(/=+$/, '')}`,
    modulusBits,
  };
};
