/** Email normalizer: provider-aware alias rules (case, plus tags, gmail dots, googlemail). */
export interface EmailRules {
  lowercase: boolean;
  stripPlus: boolean;
  stripDots: boolean;
  mergeGooglemail: boolean;
  allDomains: boolean;
}

export const DEFAULT_EMAIL_RULES: EmailRules = {
  lowercase: true,
  stripPlus: true,
  stripDots: true,
  mergeGooglemail: true,
  allDomains: false,
};

export type EmailChange = 'lowercase' | 'plusTag' | 'dots' | 'googlemail' | 'trimmed';

export interface EmailRow {
  original: string;
  normalized: string;
  valid: boolean;
  changes: EmailChange[];
  duplicateOf: number | null;
}

const PLUS_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'fastmail.com', 'proton.me', 'protonmail.com', 'yahoo.com']);
const DOT_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (input: string, rules: EmailRules): Omit<EmailRow, 'duplicateOf'> => {
  const original = input;
  const changes: EmailChange[] = [];
  let value = input.trim();
  if (value !== input) changes.push('trimmed');
  const at = value.lastIndexOf('@');
  if (at < 1) return { original, normalized: value, valid: false, changes };
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  if (rules.lowercase) {
    if (local !== local.toLowerCase() || domain !== domain.toLowerCase()) changes.push('lowercase');
    local = local.toLowerCase();
    domain = domain.toLowerCase();
  }
  const lowerDomain = domain.toLowerCase();
  if (rules.mergeGooglemail && lowerDomain === 'googlemail.com') { domain = 'gmail.com'; changes.push('googlemail'); }
  const effective = domain.toLowerCase();
  if (rules.stripPlus && (rules.allDomains || PLUS_DOMAINS.has(effective)) && local.includes('+')) {
    local = local.slice(0, local.indexOf('+'));
    changes.push('plusTag');
  }
  if (rules.stripDots && DOT_DOMAINS.has(effective) && local.includes('.')) {
    local = local.replace(/\./g, '');
    changes.push('dots');
  }
  value = `${local}@${domain}`;
  return { original, normalized: value, valid: EMAIL_PATTERN.test(value) && local.length > 0, changes };
};

export const normalizeEmailList = (text: string, rules: EmailRules): EmailRow[] => {
  const seen = new Map<string, number>();
  return text.split(/[\n,;]+/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const row = normalizeEmail(line, rules);
    const key = row.normalized.toLowerCase();
    const first = seen.get(key);
    if (first === undefined && row.valid) seen.set(key, index);
    return { ...row, duplicateOf: first !== undefined && row.valid ? first : null };
  });
};
