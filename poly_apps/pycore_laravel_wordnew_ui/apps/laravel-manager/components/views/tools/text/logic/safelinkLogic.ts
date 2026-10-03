/** Safelink helper: unwrap security-scanner redirect URLs, defang / refang and percent-encode links. */
export type SafelinkProvider = 'outlook' | 'proofpointV2' | 'proofpointV3' | 'google' | 'redirectParam';

export interface UnwrapStep {
  provider: SafelinkProvider;
  from: string;
  to: string;
}

const REDIRECT_KEYS = ['url', 'u', 'q', 'target', 'redirect', 'redirect_uri', 'dest', 'destination', 'link', 'r'];
const MAX_DEPTH = 6;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const proofpointV2 = (url: URL): string | null => {
  const encoded = url.searchParams.get('u');
  if (!encoded) return null;
  return safeDecode(encoded.replace(/_/g, '/').replace(/-([0-9A-Fa-f]{2})/g, '%$1'));
};

const proofpointV3 = (href: string): string | null => {
  const match = /\/v3\/__(.+?)__;/.exec(href);
  return match ? safeDecode(match[1]) : null;
};

const unwrapOnce = (href: string): UnwrapStep | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host.endsWith('safelinks.protection.outlook.com')) {
    const target = url.searchParams.get('url');
    if (target) return { provider: 'outlook', from: href, to: target };
  }
  if (host === 'urldefense.proofpoint.com' && url.pathname.startsWith('/v2/')) {
    const target = proofpointV2(url);
    if (target) return { provider: 'proofpointV2', from: href, to: target };
  }
  if ((host === 'urldefense.com' || host === 'urldefense.proofpoint.com') && url.pathname.startsWith('/v3/')) {
    const target = proofpointV3(href);
    if (target) return { provider: 'proofpointV3', from: href, to: target };
  }
  if (host.startsWith('www.google.') && url.pathname === '/url') {
    const target = url.searchParams.get('q') ?? url.searchParams.get('url');
    if (target) return { provider: 'google', from: href, to: target };
  }
  for (const key of REDIRECT_KEYS) {
    const target = url.searchParams.get(key);
    if (target && /^https?:\/\//i.test(target)) return { provider: 'redirectParam', from: href, to: target };
  }
  return null;
};

export const refang = (text: string): string => text
  .replace(/^hxxp/i, 'http').replace(/\[:\]/g, ':').replace(/\[\.\]|\(\.\)|\[dot\]/gi, '.').replace(/\[\/\]/g, '/').replace(/\[@\]|\[at\]/gi, '@');

export const defang = (text: string): string => text
  .replace(/^http/i, 'hxxp').replace(/\./g, '[.]').replace(/@/g, '[@]');

export const unwrapSafelink = (input: string): { final: string; steps: UnwrapStep[] } => {
  let current = refang(input.trim());
  const steps: UnwrapStep[] = [];
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const step = unwrapOnce(current);
    if (!step) break;
    steps.push(step);
    current = step.to;
  }
  return { final: current, steps };
};

export const percentEncode = (text: string): string => encodeURIComponent(text);

export const percentDecode = (text: string): string => safeDecode(text);
