/** Phone number parser: calling-code table with national length ranges and display grouping. */
interface PhoneRegion {
  region: string;
  code: string;
  min: number;
  max: number;
  groups: number[];
  trunk: string;
}

const R = (region: string, code: string, min: number, max: number, groups: number[], trunk = '0'): PhoneRegion => ({ region, code, min, max, groups, trunk });

export const PHONE_REGIONS: readonly PhoneRegion[] = [
  R('US', '1', 10, 10, [3, 3, 4], '1'), R('CA', '1', 10, 10, [3, 3, 4], '1'),
  R('GB', '44', 9, 10, [4, 6]), R('DE', '49', 6, 13, [3, 8]), R('FR', '33', 9, 9, [1, 2, 2, 2, 2]),
  R('ES', '34', 9, 9, [3, 3, 3], ''), R('IT', '39', 6, 11, [3, 3, 4], ''), R('NL', '31', 9, 9, [2, 7]),
  R('BE', '32', 8, 9, [3, 2, 2, 2]), R('CH', '41', 9, 9, [2, 3, 2, 2]), R('AT', '43', 4, 13, [3, 4, 4]),
  R('SE', '46', 7, 13, [2, 3, 2, 2]), R('NO', '47', 8, 8, [3, 2, 3], ''), R('DK', '45', 8, 8, [2, 2, 2, 2], ''),
  R('FI', '358', 5, 12, [2, 3, 4]), R('PL', '48', 9, 9, [3, 3, 3], ''), R('PT', '351', 9, 9, [3, 3, 3], ''),
  R('IE', '353', 7, 11, [2, 3, 4]), R('CZ', '420', 9, 9, [3, 3, 3], ''), R('RU', '7', 10, 10, [3, 3, 2, 2], '8'),
  R('UA', '380', 9, 9, [2, 3, 2, 2]), R('TR', '90', 10, 10, [3, 3, 2, 2]), R('GR', '30', 10, 10, [3, 3, 4], ''),
  R('IL', '972', 8, 9, [2, 3, 4]), R('SA', '966', 8, 9, [2, 3, 4]), R('AE', '971', 8, 9, [2, 3, 4]),
  R('IN', '91', 10, 10, [5, 5]), R('CN', '86', 10, 11, [3, 4, 4]), R('JP', '81', 9, 10, [2, 4, 4]),
  R('KR', '82', 8, 10, [2, 4, 4]), R('HK', '852', 8, 8, [4, 4], ''), R('TW', '886', 8, 9, [3, 3, 3]),
  R('SG', '65', 8, 8, [4, 4], ''), R('MY', '60', 9, 10, [2, 4, 4]), R('TH', '66', 8, 9, [2, 3, 4]),
  R('VN', '84', 9, 10, [2, 4, 4]), R('ID', '62', 8, 12, [3, 4, 4]), R('PH', '63', 10, 10, [3, 3, 4]),
  R('AU', '61', 9, 9, [3, 3, 3]), R('NZ', '64', 8, 10, [2, 3, 4]), R('BR', '55', 10, 11, [2, 5, 4]),
  R('MX', '52', 10, 10, [3, 3, 4], ''), R('AR', '54', 10, 11, [2, 4, 4]), R('CL', '56', 9, 9, [1, 4, 4], ''),
  R('CO', '57', 10, 10, [3, 3, 4], ''), R('ZA', '27', 9, 9, [2, 3, 4]), R('EG', '20', 9, 10, [2, 4, 4]),
  R('NG', '234', 8, 10, [3, 3, 4]), R('KE', '254', 9, 9, [3, 3, 3]), R('PK', '92', 10, 10, [3, 7]),
  R('BD', '880', 10, 10, [4, 6]),
];

export type PhoneIssue = 'empty' | 'noDigits' | 'unknownCode' | 'tooShort' | 'tooLong';

export interface PhoneReport {
  valid: boolean;
  issue: PhoneIssue | null;
  region: string | null;
  code: string;
  national: string;
  e164: string;
  international: string;
  nationalFormat: string;
  uri: string;
  digits: string;
  hadPlus: boolean;
  expected: { min: number; max: number } | null;
}

const BY_CODE = new Map<string, PhoneRegion[]>();
PHONE_REGIONS.forEach((entry) => BY_CODE.set(entry.code, [...(BY_CODE.get(entry.code) ?? []), entry]));

const applyGroups = (digits: string, groups: number[]): string => {
  const parts: string[] = [];
  let cursor = 0;
  groups.forEach((size, index) => {
    if (cursor >= digits.length) return;
    const take = index === groups.length - 1 ? digits.length - cursor : size;
    parts.push(digits.slice(cursor, cursor + take));
    cursor += take;
  });
  if (cursor < digits.length) parts.push(digits.slice(cursor));
  return parts.join(' ');
};

const nationalDisplay = (entry: PhoneRegion, nsn: string): string => {
  if ((entry.region === 'US' || entry.region === 'CA') && nsn.length === 10) return `(${nsn.slice(0, 3)}) ${nsn.slice(3, 6)}-${nsn.slice(6)}`;
  const grouped = applyGroups(nsn, entry.groups);
  return entry.trunk && entry.trunk !== '1' ? `${entry.trunk}${grouped}` : grouped;
};

export const phoneRegionOptions = (): string[] => PHONE_REGIONS.map((entry) => entry.region);

export const regionCallingCode = (region: string): string => PHONE_REGIONS.find((entry) => entry.region === region)?.code ?? '';

export const parsePhone = (input: string, defaultRegion: string): PhoneReport => {
  const empty: PhoneReport = {
    valid: false, issue: null, region: null, code: '', national: '', e164: '', international: '', nationalFormat: '', uri: '', digits: '', hadPlus: false, expected: null,
  };
  const trimmed = input.trim();
  if (!trimmed) return { ...empty, issue: 'empty' };
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return { ...empty, issue: 'noDigits' };
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  let candidates: PhoneRegion[] | undefined;
  let rest = digits;
  if (international) {
    rest = trimmed.startsWith('00') && !trimmed.startsWith('+') ? digits.slice(2) : digits;
    for (const size of [3, 2, 1]) {
      const hit = BY_CODE.get(rest.slice(0, size));
      if (hit) { candidates = hit; rest = rest.slice(size); break; }
    }
    if (!candidates) return { ...empty, issue: 'unknownCode', digits, hadPlus: true };
  } else {
    const fallback = PHONE_REGIONS.find((entry) => entry.region === defaultRegion) ?? PHONE_REGIONS[0];
    candidates = BY_CODE.get(fallback.code) ?? [fallback];
    candidates = [fallback, ...candidates.filter((entry) => entry !== fallback)];
    if (fallback.trunk && rest.startsWith(fallback.trunk) && rest.length > fallback.max) rest = rest.slice(fallback.trunk.length);
  }
  const entry = candidates[0];
  if (international && entry.trunk && entry.trunk !== '1' && rest.startsWith(entry.trunk) && rest.length > entry.max) rest = rest.slice(entry.trunk.length);
  const issue: PhoneIssue | null = rest.length < entry.min ? 'tooShort' : rest.length > entry.max ? 'tooLong' : null;
  return {
    valid: issue === null,
    issue,
    region: entry.region,
    code: entry.code,
    national: rest,
    e164: `+${entry.code}${rest}`,
    international: `+${entry.code} ${applyGroups(rest, entry.groups)}`,
    nationalFormat: nationalDisplay(entry, rest),
    uri: `tel:+${entry.code}${rest}`,
    digits,
    hadPlus: international,
    expected: { min: entry.min, max: entry.max },
  };
};
