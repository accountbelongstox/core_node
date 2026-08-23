import { AppError } from './appError';
import serviceContract from '../../../config/service_contract.json';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);
const REQUIRED_HTTP_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEFAULT_ROOT_DOMAIN = serviceContract.access.root_domains[0];
const DEFAULT_REGION = serviceContract.access.default_api_region_prefix;
const LARAVEL_API_LABELS = serviceContract.access.service_domains.laravel_api;
const DEFAULT_BACKEND_HOST = [
  ...LARAVEL_API_LABELS.map((label) => label === '{region}' ? DEFAULT_REGION : label),
  DEFAULT_ROOT_DOMAIN,
].join('.');

export const DEFAULT_BACKEND_URL = `https://${DEFAULT_BACKEND_HOST}`;

export function parseBackendUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError('backend.urlInvalid');
  }
  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) throw new AppError('backend.urlProtocol');
  if (url.username || url.password) throw new AppError('backend.urlCredentials');
  return url;
}

export function normalizeBackendUrl(value: string): string {
  const url = parseBackendUrl(value);
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function requestBackendOrigin(value: string): Promise<boolean> {
  const url = parseBackendUrl(value);
  if (url.protocol === 'http:' && REQUIRED_HTTP_HOSTS.has(url.hostname)) {
    return Promise.resolve(true);
  }
  return chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
}
