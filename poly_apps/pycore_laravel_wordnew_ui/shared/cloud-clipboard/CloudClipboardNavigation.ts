import { CLOUD_CLIPBOARD } from '../../core/contracts/CloudClipboardContract';
import { END_META } from '../../shell/shellTypes';

export const CLOUD_CLIPBOARD_PAGE_SLUG = 'cloud-clipboard';
export const CLOUD_CLIPBOARD_PATHS = {
  laravel: `${END_META['laravel-manager'].path}/${CLOUD_CLIPBOARD_PAGE_SLUG}`,
  pycore: `${END_META['pycore-manager'].path}/${CLOUD_CLIPBOARD_PAGE_SLUG}`,
} as const;

export function readCloudClipboardNamespace(location: { search: string; hash: string }): string {
  const params = new URLSearchParams(location.search);
  const hashQueryIndex = location.hash.indexOf('?');
  const hashParams = new URLSearchParams(hashQueryIndex >= 0 ? location.hash.slice(hashQueryIndex + 1) : '');
  return (params.get(CLOUD_CLIPBOARD.namespace_query) ?? hashParams.get(CLOUD_CLIPBOARD.namespace_query) ?? '').trim().toLowerCase();
}

export function createCloudClipboardShareUrl(namespace: string): string {
  const path = window.location.pathname.startsWith(END_META['pycore-manager'].path)
    ? CLOUD_CLIPBOARD_PATHS.pycore : CLOUD_CLIPBOARD_PATHS.laravel;
  const url = new URL(path, window.location.origin);
  if (namespace) url.searchParams.set(CLOUD_CLIPBOARD.namespace_query, namespace);
  return url.href;
}
