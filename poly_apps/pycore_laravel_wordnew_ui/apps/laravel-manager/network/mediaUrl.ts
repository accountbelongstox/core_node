import { getDefaultBaseURL } from '../../../config/constants';
import { getSharedBaseURL } from '../api/base/BaseAPI';

/** Resolve Laravel-owned media against the currently selected API endpoint. */
export function laravelMediaUrl(value?: string | null): string {
  if (!value) return value ?? '';
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  const baseURL = getSharedBaseURL() ?? getDefaultBaseURL();
  return value.startsWith('/') ? `${baseURL}${value}` : `${baseURL}/${value}`;
}
