/** BIP-39 mnemonic generation, validation and seed derivation in the browser. */
import { digest, randomBytes, toHex, utf8Encode } from './cryptoCore';
import { BIP39_WORDLIST } from './bip39Words';

export type MnemonicIssue = 'empty' | 'length' | 'word' | 'checksum';

export interface MnemonicCheck {
  valid: boolean;
  issue: MnemonicIssue | null;
  badWord: string | null;
  words: string[];
}

export const BIP39_STRENGTHS: readonly number[] = [128, 160, 192, 224, 256];
export const BIP39_WORD_COUNTS: readonly number[] = BIP39_STRENGTHS.map((bits) => (bits + bits / 32) / 11);

const WORD_BITS = 11;
const SEED_ITERATIONS = 2048;
const SEED_BYTES = 64;
const WORD_INDEX = new Map(BIP39_WORDLIST.map((word, index) => [word, index]));

const bitString = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');

const checksumBits = async (entropy: Uint8Array): Promise<string> => {
  const hash = await digest('SHA-256', entropy);
  return bitString(hash).slice(0, entropy.length * 8 / 32);
};

export const entropyToMnemonic = async (entropy: Uint8Array): Promise<string[]> => {
  const bits = bitString(entropy) + await checksumBits(entropy);
  return Array.from({ length: bits.length / WORD_BITS }, (_, i) => BIP39_WORDLIST[parseInt(bits.slice(i * WORD_BITS, (i + 1) * WORD_BITS), 2)]);
};

export const generateMnemonic = (strength: number): Promise<string[]> => entropyToMnemonic(randomBytes(strength / 8));

export const checkMnemonic = async (phrase: string): Promise<MnemonicCheck> => {
  const words = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { valid: false, issue: 'empty', badWord: null, words };
  const unknown = words.find((word) => !WORD_INDEX.has(word));
  if (unknown !== undefined) return { valid: false, issue: 'word', badWord: unknown, words };
  if (!BIP39_WORD_COUNTS.includes(words.length)) return { valid: false, issue: 'length', badWord: null, words };
  const bits = words.map((word) => WORD_INDEX.get(word)!.toString(2).padStart(WORD_BITS, '0')).join('');
  const entropyLength = bits.length - bits.length / 33;
  const entropy = Uint8Array.from({ length: entropyLength / 8 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
  const valid = bits.slice(entropyLength) === await checksumBits(entropy);
  return { valid, issue: valid ? null : 'checksum', badWord: null, words };
};

/** PBKDF2-HMAC-SHA512 seed (2048 rounds, salt "mnemonic" + passphrase) as hex. */
export const mnemonicToSeedHex = async (words: string[], passphrase: string): Promise<string> => {
  const material = await crypto.subtle.importKey('raw', utf8Encode(words.join(' ').normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
  const salt = utf8Encode(`mnemonic${passphrase}`.normalize('NFKD'));
  return toHex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: SEED_ITERATIONS, hash: 'SHA-512' }, material, SEED_BYTES * 8)));
};
