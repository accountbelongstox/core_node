/** Text obfuscator: reversible text transforms with matching decoders. */
export const OBFUSCATE_METHODS = ['unicode', 'hex', 'rot', 'base64', 'reverse', 'html', 'percent', 'binary', 'leet'] as const;
export type ObfuscateMethod = (typeof OBFUSCATE_METHODS)[number];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LEET: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9', l: '1' };
const UNLEET: Record<string, string> = { 4: 'a', 3: 'e', 1: 'i', 0: 'o', 5: 's', 7: 't', 8: 'b', 9: 'g' };

const rotate = (text: string, shift: number): string => text.replace(/[a-z]/gi, (char) => {
  const base = char <= 'Z' ? 65 : 97;
  return String.fromCharCode(((char.charCodeAt(0) - base + shift + 26) % 26) + base);
});

const toBase64 = (text: string): string => {
  let binary = '';
  encoder.encode(text).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (text: string): string => {
  const binary = atob(text.trim());
  return decoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

export const REVERSIBLE: Record<ObfuscateMethod, boolean> = {
  unicode: true, hex: true, rot: true, base64: true, reverse: true, html: true, percent: true, binary: true, leet: false,
};

export const obfuscate = (text: string, method: ObfuscateMethod, shift: number): string => {
  switch (method) {
    case 'unicode': return Array.from(text).map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0xffff ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`;
    }).join('');
    case 'hex': return Array.from(encoder.encode(text)).map((byte) => `\\x${byte.toString(16).padStart(2, '0')}`).join('');
    case 'rot': return rotate(text, shift);
    case 'base64': return toBase64(text);
    case 'reverse': return Array.from(text).reverse().join('');
    case 'html': return Array.from(text).map((char) => `&#x${(char.codePointAt(0) ?? 0).toString(16)};`).join('');
    case 'percent': return Array.from(encoder.encode(text)).map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
    case 'binary': return Array.from(encoder.encode(text)).map((byte) => byte.toString(2).padStart(8, '0')).join(' ');
    case 'leet': return text.replace(/[a-z]/gi, (char) => LEET[char.toLowerCase()] ?? char);
    default: return text;
  }
};

export const deobfuscate = (text: string, method: ObfuscateMethod, shift: number): string => {
  switch (method) {
    case 'unicode': return text.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, long: string | undefined, short: string | undefined) => String.fromCodePoint(parseInt(long ?? short ?? '0', 16)));
    case 'hex': {
      const bytes = (text.match(/\\x([0-9a-f]{2})/gi) ?? []).map((token) => parseInt(token.slice(2), 16));
      return decoder.decode(Uint8Array.from(bytes));
    }
    case 'rot': return rotate(text, -shift);
    case 'base64': return fromBase64(text);
    case 'reverse': return Array.from(text).reverse().join('');
    case 'html': return text.replace(/&#x([0-9a-f]+);|&#(\d+);/gi, (_, hex: string | undefined, dec: string | undefined) => String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec)));
    case 'percent': return decodeURIComponent(text);
    case 'binary': return decoder.decode(Uint8Array.from((text.match(/[01]{8}/g) ?? []).map((chunk) => parseInt(chunk, 2))));
    case 'leet': return text.replace(/[0-9]/g, (digit) => UNLEET[digit] ?? digit);
    default: return text;
  }
};
