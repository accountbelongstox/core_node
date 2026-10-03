/** HTTP status code reference data; names and descriptions are localized under toolsWeb.httpStatus.codes. */

export type StatusClass = 1 | 2 | 3 | 4 | 5;

export interface HttpStatusInfo {
  code: number;
  rfc: string;
  headers: string[];
  cacheable: boolean;
  retry: boolean;
  deprecated: boolean;
}

export const STATUS_CLASSES: StatusClass[] = [1, 2, 3, 4, 5];

const R9110 = '9110';
const CACHEABLE = new Set([200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501]);
const RETRY = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEPRECATED = new Set([305]);

const RFC_OVERRIDES: Record<number, string> = {
  102: '2518', 103: '8297', 207: '4918', 208: '5842', 226: '3229', 418: '2324', 423: '4918', 424: '4918', 425: '8470', 428: '6585', 429: '6585',
  431: '6585', 451: '7725', 506: '2295', 507: '4918', 508: '5842', 510: '2774', 511: '6585',
};

const HEADERS: Record<number, string[]> = {
  101: ['Upgrade', 'Connection'], 103: ['Link'], 201: ['Location'], 202: ['Content-Location'], 206: ['Content-Range', 'Content-Length'], 300: ['Location'],
  301: ['Location'], 302: ['Location'], 303: ['Location'], 304: ['ETag', 'Cache-Control', 'Vary'], 305: ['Location'], 307: ['Location'], 308: ['Location'],
  401: ['WWW-Authenticate'], 405: ['Allow'], 407: ['Proxy-Authenticate'], 408: ['Connection'], 413: ['Retry-After'], 416: ['Content-Range'], 426: ['Upgrade'],
  429: ['Retry-After'], 503: ['Retry-After'], 511: ['Proxy-Authenticate'],
};

const CODES = [
  100, 101, 102, 103, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 307, 308,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
];

export const HTTP_STATUSES: HttpStatusInfo[] = CODES.map((code) => ({
  code,
  rfc: RFC_OVERRIDES[code] ?? R9110,
  headers: HEADERS[code] ?? [],
  cacheable: CACHEABLE.has(code),
  retry: RETRY.has(code),
  deprecated: DEPRECATED.has(code),
}));

export const statusClassOf = (code: number): StatusClass => Math.floor(code / 100) as StatusClass;

export const findStatus = (code: number): HttpStatusInfo | undefined => HTTP_STATUSES.find((status) => status.code === code);
