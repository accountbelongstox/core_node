/** Random token generation with an unbiased draw from a configurable alphabet or from raw bytes. */
import { randomBytes, randomInt, toHex } from './cryptoCore';

export type TokenKind = 'charset' | 'hex' | 'base64url';

export interface TokenOptions {
  kind: TokenKind;
  length: number;
  count: number;
  prefix: string;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  custom: string;
}

export const TOKEN_ALPHABETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
} as const;

export const DEFAULT_TOKEN_OPTIONS: TokenOptions = {
  kind: 'charset', length: 32, count: 5, prefix: '', lower: true, upper: true, digits: true, symbols: false, excludeAmbiguous: false, custom: '',
};

const AMBIGUOUS = /[0O1lI|`'"]/g;
const BYTE_LIMITS = { min: 8, max: 128 };
const CHAR_LIMITS = { min: 4, max: 256 };

export const tokenLengthLimits = (kind: TokenKind): { min: number; max: number } => (kind === 'charset' ? CHAR_LIMITS : BYTE_LIMITS);

export const buildAlphabet = (options: TokenOptions): string => {
  let pool = '';
  if (options.lower) pool += TOKEN_ALPHABETS.lower;
  if (options.upper) pool += TOKEN_ALPHABETS.upper;
  if (options.digits) pool += TOKEN_ALPHABETS.digits;
  if (options.symbols) pool += TOKEN_ALPHABETS.symbols;
  pool += options.custom;
  if (options.excludeAmbiguous) pool = pool.replace(AMBIGUOUS, '');
  return Array.from(new Set(pool)).join('');
};

export const tokenEntropyBits = (options: TokenOptions): number => {
  if (options.kind !== 'charset') return options.length * 8;
  const size = buildAlphabet(options).length;
  return size > 1 ? options.length * Math.log2(size) : 0;
};

const toBase64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const generateTokens = (options: TokenOptions): string[] => {
  const alphabet = options.kind === 'charset' ? Array.from(buildAlphabet(options)) : [];
  if (options.kind === 'charset' && alphabet.length < 2) return [];
  return Array.from({ length: options.count }, () => {
    let body: string;
    if (options.kind === 'hex') body = toHex(randomBytes(options.length));
    else if (options.kind === 'base64url') body = toBase64Url(randomBytes(options.length));
    else body = Array.from({ length: options.length }, () => alphabet[randomInt(alphabet.length)]).join('');
    return options.prefix + body;
  });
};
