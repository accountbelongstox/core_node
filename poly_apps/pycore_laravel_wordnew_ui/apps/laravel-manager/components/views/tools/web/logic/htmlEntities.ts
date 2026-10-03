/** HTML entity encoding and decoding with per-character statistics. */

export type EntityStyle = 'named' | 'decimal' | 'hex';
export type EntityScope = 'minimal' | 'nonascii' | 'all';

export interface EntityOptions {
  style: EntityStyle;
  scope: EntityScope;
}

export interface EntityStat {
  char: string;
  entity: string;
  count: number;
}

export interface EncodeResult {
  output: string;
  stats: EntityStat[];
}

const MINIMAL: Record<string, string> = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' };
const NAMED: Record<string, string> = {
  '\u00a0': 'nbsp', '¡': 'iexcl', '¢': 'cent', '£': 'pound', '¤': 'curren', '¥': 'yen', '¦': 'brvbar', '§': 'sect', '¨': 'uml', '©': 'copy', 'ª': 'ordf', '«': 'laquo', '¬': 'not',
  '\u00ad': 'shy', '®': 'reg', '¯': 'macr', '°': 'deg', '±': 'plusmn', '²': 'sup2', '³': 'sup3', '´': 'acute', 'µ': 'micro', '¶': 'para', '·': 'middot', '¸': 'cedil', '¹': 'sup1',
  'º': 'ordm', '»': 'raquo', '¼': 'frac14', '½': 'frac12', '¾': 'frac34', '¿': 'iquest', 'À': 'Agrave', 'Á': 'Aacute', 'Â': 'Acirc', 'Ã': 'Atilde', 'Ä': 'Auml', 'Å': 'Aring',
  'Æ': 'AElig', 'Ç': 'Ccedil', 'È': 'Egrave', 'É': 'Eacute', 'Ê': 'Ecirc', 'Ë': 'Euml', 'Ì': 'Igrave', 'Í': 'Iacute', 'Î': 'Icirc', 'Ï': 'Iuml', 'Ñ': 'Ntilde', 'Ò': 'Ograve',
  'Ó': 'Oacute', 'Ô': 'Ocirc', 'Õ': 'Otilde', 'Ö': 'Ouml', '×': 'times', 'Ø': 'Oslash', 'Ù': 'Ugrave', 'Ú': 'Uacute', 'Û': 'Ucirc', 'Ü': 'Uuml', 'Ý': 'Yacute', 'ß': 'szlig',
  'à': 'agrave', 'á': 'aacute', 'â': 'acirc', 'ã': 'atilde', 'ä': 'auml', 'å': 'aring', 'æ': 'aelig', 'ç': 'ccedil', 'è': 'egrave', 'é': 'eacute', 'ê': 'ecirc', 'ë': 'euml',
  'ì': 'igrave', 'í': 'iacute', 'î': 'icirc', 'ï': 'iuml', 'ñ': 'ntilde', 'ò': 'ograve', 'ó': 'oacute', 'ô': 'ocirc', 'õ': 'otilde', 'ö': 'ouml', '÷': 'divide', 'ø': 'oslash',
  'ù': 'ugrave', 'ú': 'uacute', 'û': 'ucirc', 'ü': 'uuml', 'ý': 'yacute', 'ÿ': 'yuml', 'Œ': 'OElig', 'œ': 'oelig', 'Š': 'Scaron', 'š': 'scaron', 'ƒ': 'fnof', 'ˆ': 'circ', '˜': 'tilde',
  'Α': 'Alpha', 'Β': 'Beta', 'Γ': 'Gamma', 'Δ': 'Delta', 'Ω': 'Omega', 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma', 'ω': 'omega',
  '\u2002': 'ensp', '\u2003': 'emsp', '\u2009': 'thinsp', '–': 'ndash', '—': 'mdash', '‘': 'lsquo', '’': 'rsquo', '‚': 'sbquo', '“': 'ldquo', '”': 'rdquo', '„': 'bdquo', '†': 'dagger',
  '‡': 'Dagger', '•': 'bull', '…': 'hellip', '‰': 'permil', '′': 'prime', '″': 'Prime', '‹': 'lsaquo', '›': 'rsaquo', '€': 'euro', '™': 'trade', '←': 'larr', '↑': 'uarr', '→': 'rarr',
  '↓': 'darr', '↔': 'harr', '⇒': 'rArr', '⇔': 'hArr', '∀': 'forall', '∂': 'part', '∃': 'exist', '∅': 'empty', '∇': 'nabla', '∈': 'isin', '∑': 'sum', '−': 'minus', '√': 'radic',
  '∞': 'infin', '∩': 'cap', '∪': 'cup', '∫': 'int', '≈': 'asymp', '≠': 'ne', '≡': 'equiv', '≤': 'le', '≥': 'ge', '♠': 'spades', '♣': 'clubs', '♥': 'hearts', '♦': 'diams',
};

const isAscii = (code: number): boolean => code < 128;

const entityFor = (char: string, style: EntityStyle): string => {
  const code = char.codePointAt(0) as number;
  if (style === 'named') {
    const name = MINIMAL[char] ?? NAMED[char];
    if (name) return `&${name};`;
  }
  return style === 'hex' ? `&#x${code.toString(16).toUpperCase()};` : `&#${code};`;
};

export function encodeHtml(text: string, options: EntityOptions): EncodeResult {
  const counts = new Map<string, EntityStat>();
  let output = '';
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    const minimal = char in MINIMAL;
    const control = options.scope === 'all' && (code < 32 || code === 127) && char !== '\n' && char !== '\t' && char !== '\r';
    const plainAscii = options.scope === 'all' && isAscii(code) && /[^A-Za-z0-9\s]/.test(char);
    const encode = minimal || (options.scope !== 'minimal' && !isAscii(code)) || control || plainAscii;
    if (!encode) {
      output += char;
      continue;
    }
    const entity = entityFor(char, options.style);
    const stat = counts.get(char);
    if (stat) stat.count++;
    else counts.set(char, { char, entity, count: 1 });
    output += entity;
  }
  return { output, stats: Array.from(counts.values()).sort((a, b) => b.count - a.count) };
}

const NUMERIC_ENTITY = /&#(?:x([0-9a-f]+)|(\d+));/gi;
const FALLBACK_NAMES: Record<string, string> = Object.fromEntries([...Object.entries(MINIMAL), ...Object.entries(NAMED)].map(([char, name]) => [name, char]));

export function decodeHtml(text: string): string {
  if (typeof document !== 'undefined') {
    const holder = document.createElement('textarea');
    holder.innerHTML = text;
    return holder.value;
  }
  return text
    .replace(NUMERIC_ENTITY, (match, hex: string | undefined, dec: string | undefined) => {
      const code = hex ? parseInt(hex, 16) : Number(dec);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/&([A-Za-z][A-Za-z0-9]*);/g, (match, name: string) => FALLBACK_NAMES[name] ?? (name === 'apos' ? "'" : match));
}

export const countEntities = (text: string): number => (text.match(/&(?:[A-Za-z][A-Za-z0-9]*|#\d+|#x[0-9a-fA-F]+);/g) ?? []).length;
