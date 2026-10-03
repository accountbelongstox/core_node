/** URL parser: component model with two-way rebuild (parse into parts, build parts back into a URL). */
export interface QueryParam {
  id: number;
  key: string;
  value: string;
}

export interface UrlParts {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  params: QueryParam[];
  hash: string;
}

export const COMMON_PROTOCOLS = ['https:', 'http:', 'ftp:', 'ws:', 'wss:', 'file:', 'mailto:'] as const;

const AUTHORITY_SCHEMES = new Set(['http:', 'https:', 'ftp:', 'ws:', 'wss:', 'file:']);

let paramSeed = 0;

export const nextParamId = (): number => { paramSeed += 1; return paramSeed; };

export const parseUrlParts = (text: string): UrlParts | null => {
  try {
    const url = new URL(text.trim());
    const params: QueryParam[] = [];
    url.searchParams.forEach((value, key) => params.push({ id: nextParamId(), key, value }));
    return {
      protocol: url.protocol,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      params,
      hash: url.hash.replace(/^#/, ''),
    };
  } catch {
    return null;
  }
};

export const buildQuery = (params: QueryParam[]): string => {
  const pairs = params.filter((param) => param.key !== '' || param.value !== '')
    .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
};

export const buildUrl = (parts: UrlParts): string => {
  const scheme = parts.protocol.endsWith(':') ? parts.protocol : `${parts.protocol}:`;
  const path = parts.pathname && !parts.pathname.startsWith('/') && AUTHORITY_SCHEMES.has(scheme) ? `/${parts.pathname}` : parts.pathname;
  const hash = parts.hash ? `#${parts.hash}` : '';
  if (!AUTHORITY_SCHEMES.has(scheme)) return `${scheme}${path}${buildQuery(parts.params)}${hash}`;
  const auth = parts.username ? `${encodeURIComponent(parts.username)}${parts.password ? `:${encodeURIComponent(parts.password)}` : ''}@` : '';
  const port = parts.port ? `:${parts.port}` : '';
  return `${scheme}//${auth}${parts.hostname}${port}${path}${buildQuery(parts.params)}${hash}`;
};

export type UrlSegmentKind = 'protocol' | 'auth' | 'host' | 'port' | 'path' | 'query' | 'hash';

export const urlSegments = (text: string): Array<{ kind: UrlSegmentKind; text: string }> => {
  const out: Array<{ kind: UrlSegmentKind; text: string }> = [];
  const match = /^([a-z][a-z0-9+.-]*:)(\/\/)?(?:([^@/?#]*)@)?([^:/?#]*)?(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(text.trim());
  if (!match) return [{ kind: 'path', text }];
  const [, protocol, slashes, auth, host, port, path, query, hash] = match;
  out.push({ kind: 'protocol', text: `${protocol}${slashes ?? ''}` });
  if (auth !== undefined) out.push({ kind: 'auth', text: `${auth}@` });
  if (host) out.push({ kind: 'host', text: host });
  if (port) out.push({ kind: 'port', text: `:${port}` });
  if (path) out.push({ kind: 'path', text: path });
  if (query) out.push({ kind: 'query', text: query });
  if (hash) out.push({ kind: 'hash', text: hash });
  return out;
};
