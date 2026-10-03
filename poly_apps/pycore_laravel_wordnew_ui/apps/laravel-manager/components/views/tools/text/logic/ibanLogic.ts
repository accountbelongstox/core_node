/** IBAN engine: country registry lengths, BBAN structure, mod-97 checksum with working steps. */
export interface BbanPart {
  key: 'bank' | 'branch' | 'check' | 'account' | 'cin' | 'sort';
  length: number;
}

const LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22,
  VG: 24, XK: 20,
};

const STRUCTURES: Record<string, BbanPart[]> = {
  DE: [{ key: 'bank', length: 8 }, { key: 'account', length: 10 }],
  GB: [{ key: 'bank', length: 4 }, { key: 'sort', length: 6 }, { key: 'account', length: 8 }],
  FR: [{ key: 'bank', length: 5 }, { key: 'branch', length: 5 }, { key: 'account', length: 11 }, { key: 'check', length: 2 }],
  ES: [{ key: 'bank', length: 4 }, { key: 'branch', length: 4 }, { key: 'check', length: 2 }, { key: 'account', length: 10 }],
  IT: [{ key: 'cin', length: 1 }, { key: 'bank', length: 5 }, { key: 'branch', length: 5 }, { key: 'account', length: 12 }],
  NL: [{ key: 'bank', length: 4 }, { key: 'account', length: 10 }],
  BE: [{ key: 'bank', length: 3 }, { key: 'account', length: 7 }, { key: 'check', length: 2 }],
  CH: [{ key: 'bank', length: 5 }, { key: 'account', length: 12 }],
  AT: [{ key: 'bank', length: 5 }, { key: 'account', length: 11 }],
  PT: [{ key: 'bank', length: 4 }, { key: 'branch', length: 4 }, { key: 'account', length: 11 }, { key: 'check', length: 2 }],
  PL: [{ key: 'bank', length: 8 }, { key: 'account', length: 16 }],
  SE: [{ key: 'bank', length: 3 }, { key: 'account', length: 17 }],
  NO: [{ key: 'bank', length: 4 }, { key: 'account', length: 6 }, { key: 'check', length: 1 }],
  DK: [{ key: 'bank', length: 4 }, { key: 'account', length: 10 }],
  IE: [{ key: 'bank', length: 4 }, { key: 'sort', length: 6 }, { key: 'account', length: 8 }],
};

export const IBAN_EXAMPLES: readonly string[] = [
  'DE89370400440532013000',
  'GB82WEST12345698765432',
  'FR1420041010050500013M02606',
  'ES9121000418450200051332',
  'IT60X0542811101000000123456',
  'NL91ABNA0417164300',
  'BE68539007547034',
  'CH9300762011623852957',
  'AT611904300234573201',
];

export type IbanIssue = 'empty' | 'charset' | 'tooShort' | 'unknownCountry' | 'length' | 'checkDigits' | 'checksum';

export interface IbanReport {
  clean: string;
  valid: boolean;
  issue: IbanIssue | null;
  country: string;
  expectedLength: number | null;
  checkDigits: string;
  bban: string;
  parts: Array<BbanPart & { value: string }>;
  rearranged: string;
  numeric: string;
  remainder: number | null;
  grouped: string;
}

export const cleanIban = (input: string): string => input.replace(/[\s-]+/g, '').toUpperCase();

export const groupIban = (iban: string): string => iban.replace(/(.{4})/g, '$1 ').trim();

const mod97 = (numeric: string): number => {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) remainder = Number(`${remainder}${numeric.slice(i, i + 7)}`) % 97;
  return remainder;
};

const toNumeric = (text: string): string => text.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));

export const computeCheckDigits = (country: string, bban: string): string => {
  const remainder = mod97(toNumeric(`${bban}${country}00`));
  return String(98 - remainder).padStart(2, '0');
};

export const countryExpectedLength = (country: string): number | null => LENGTHS[country] ?? null;

export const analyzeIban = (input: string): IbanReport => {
  const clean = cleanIban(input);
  const country = clean.slice(0, 2);
  const expected = LENGTHS[country] ?? null;
  const checkDigits = clean.slice(2, 4);
  const bban = clean.slice(4);
  const rearranged = `${bban}${country}${checkDigits}`;
  const numeric = /^[A-Z0-9]+$/.test(clean) ? toNumeric(rearranged) : '';
  const base: IbanReport = {
    clean, valid: false, issue: null, country, expectedLength: expected, checkDigits, bban, parts: [],
    rearranged: '', numeric: '', remainder: null, grouped: groupIban(clean),
  };
  if (!clean) return { ...base, issue: 'empty' };
  if (!/^[A-Z0-9]+$/.test(clean)) return { ...base, issue: 'charset' };
  if (clean.length < 8) return { ...base, issue: 'tooShort' };
  const structure = STRUCTURES[country];
  let cursor = 0;
  const parts = structure && bban.length === structure.reduce((sum, part) => sum + part.length, 0)
    ? structure.map((part) => { const value = bban.slice(cursor, cursor + part.length); cursor += part.length; return { ...part, value }; })
    : [];
  const shaped: IbanReport = { ...base, parts, rearranged, numeric, remainder: mod97(numeric) };
  if (!/^[A-Z]{2}$/.test(country) || expected === null) return { ...shaped, issue: 'unknownCountry' };
  if (clean.length !== expected) return { ...shaped, issue: 'length' };
  if (!/^\d{2}$/.test(checkDigits)) return { ...shaped, issue: 'checkDigits' };
  if (shaped.remainder !== 1) return { ...shaped, issue: 'checksum' };
  return { ...shaped, valid: true };
};
