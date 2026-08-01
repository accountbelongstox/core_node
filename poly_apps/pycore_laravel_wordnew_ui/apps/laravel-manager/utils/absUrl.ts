import { apiManager } from '../services/ApiManager';

/**
 * Resolve a Laravel-relative url (e.g. audio) against the active :9000 base.
 *
 * Non-throwing: apiManager.getCurrentBaseUrl() throws before an endpoint is
 * selected before its boot probe runs, so we fall
 * back to a relative url rather than crashing the render.
 */
export const absUrl = (u?: string): string => {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) return u;
  let base = '';
  try {
    base = (apiManager.getCurrentBaseUrl && apiManager.getCurrentBaseUrl()) || '';
  } catch {
    base = '';
  }
  return base.replace(/\/$/, '') + u;
};
