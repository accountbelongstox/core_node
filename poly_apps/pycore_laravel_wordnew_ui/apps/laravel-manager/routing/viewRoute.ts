import { ViewType } from '../uiTypes';
import { END_META } from '../../../shell/shellTypes';
import { CLOUD_CLIPBOARD_PAGE_SLUG } from '../../../shared/cloud-clipboard/CloudClipboardNavigation';

export const LARAVEL_MANAGER_ROOT = END_META['laravel-manager'].path;

export interface ViewLocation {
  pathname: string;
  search: string;
  hash: string;
}

export const VIEW_TO_SLUG: Record<ViewType, string> = {
  [ViewType.CLOUD_CLIPBOARD]: CLOUD_CLIPBOARD_PAGE_SLUG,
  [ViewType.DASHBOARD]: 'dashboard',
  [ViewType.MEDIA_BROWSER]: 'media',
  [ViewType.TOOLS]: 'tools',
  [ViewType.API_TESTER]: 'api',
  [ViewType.SETTINGS]: 'settings',
  [ViewType.SYSTEM_INFO]: 'system',
  [ViewType.VOCABULARY]: 'vocabulary',
  [ViewType.TASK_CENTER]: 'task-center',
  [ViewType.SERVER_MANAGER]: 'server',
  [ViewType.AI_MANAGEMENT]: 'ai-management',
  [ViewType.DATABASE_MANAGER]: 'db-manager',
};

const SLUG_TO_VIEW: Record<string, ViewType> = Object.fromEntries(
  Object.entries(VIEW_TO_SLUG).map(([view, slug]) => [slug, view as ViewType])
) as Record<string, ViewType>;

export function viewToSlug(view: ViewType): string {
  return VIEW_TO_SLUG[view] ?? '';
}

export function slugToView(rawSlug: string | null | undefined): ViewType | null {
  let s = rawSlug?.trim().replace(/^[#/]+/, '') ?? '';
  const queryIx = s.indexOf('?');
  if (queryIx >= 0) s = s.slice(0, queryIx);
  s = s.replace(/\/+$/, '');
  if (!s) return null;
  return SLUG_TO_VIEW[s] ?? null;
}

export function readViewFromLocation(location: ViewLocation): ViewType | null {
  const relativePath = location.pathname === LARAVEL_MANAGER_ROOT
    ? '' : location.pathname.startsWith(`${LARAVEL_MANAGER_ROOT}/`)
      ? location.pathname.slice(LARAVEL_MANAGER_ROOT.length + 1) : '';
  const pathView = slugToView(relativePath);
  return pathView ?? (!relativePath ? slugToView(location.hash) : null);
}

export function createViewLocation(view: ViewType, location: ViewLocation): ViewLocation {
  const params = new URLSearchParams(location.search);
  const legacyQueryIndex = location.hash.indexOf('?');
  const legacyView = slugToView(location.hash);
  const hash = legacyView ? '' : location.hash;
  if (legacyView && legacyQueryIndex >= 0) {
    new URLSearchParams(location.hash.slice(legacyQueryIndex + 1)).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  return {
    pathname: `${LARAVEL_MANAGER_ROOT}/${viewToSlug(view)}`,
    search: params.toString() ? `?${params}` : '',
    hash,
  };
}
