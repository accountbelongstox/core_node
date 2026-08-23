import { getDefaultBaseURL } from './LaravelConfig';
import { getSharedBaseURL } from './transport/BaseAPI';

const LARAVEL_MEDIA_PATH_PREFIXES = ['/api/', '/static/', '/avatar/'];

/** Resolve Laravel-owned media against the currently selected API endpoint. */
export function laravelMediaUrl(value?: string | null): string {
  let parsed: URL | null = null;
  let path = '';
  let baseURL = '';
  if (!value) return value ?? '';
  if (/^(data|blob):/i.test(value)) return value;
  baseURL = getSharedBaseURL() ?? getDefaultBaseURL();
  if (/^http:\/\//i.test(value) && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    try {
      parsed = new URL(value);
    } catch {
      parsed = null;
    }
    if (parsed && LARAVEL_MEDIA_PATH_PREFIXES.some((prefix) => parsed!.pathname.startsWith(prefix))) {
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return `${baseURL}${path}`;
    }
  }
  if (/^(https?:)?\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${baseURL}${value}` : `${baseURL}/${value}`;
}
