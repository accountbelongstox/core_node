import type { WfNewContentKind } from '../api';

export const WORDNEW_HASH_ROUTES = Object.freeze({
  dailyReading: 'daily-reading',
  wordGroups: 'shelf',
  orchAudio: 'orch-audio',
});

/** Tabs whose hash carries a sub-path (`#/<tab>/<id>`) or query the tab owns. */
const ITEM_ROUTE_TABS: readonly WordNewTab[] = Object.freeze(['daily-reading', 'orch-audio']);

export type WordNewTab =
  | 'home' | 'shelf' | 'practice' | 'labs' | 'settings' | 'walkman'
  | 'subtitles' | 'stats' | 'bilingual' | 'social' | 'profile' | 'auth' | 'languages'
  | 'learning-model' | 'review-settings' | 'playback' | 'book-reader' | 'content-list' | 'library' | 'about'
  | 'daily-reading' | 'orch-audio' | 'admin';

export const WORDNEW_TABS: readonly WordNewTab[] = Object.freeze([
  'home', 'shelf', 'practice', 'labs', 'settings', 'walkman', 'subtitles',
  'stats', 'bilingual', 'social', 'profile', 'auth', 'languages',
  'learning-model', 'review-settings', 'playback', 'book-reader', 'content-list', 'about',
  'daily-reading', 'orch-audio', 'admin',
]);

export function wordNewPageHeader(
  tab: WordNewTab,
  trans: (key: string, replacements?: Record<string, string | number>) => string,
  context: {
    contentListKind: WfNewContentKind | null;
    wordGroupTitle?: string;
    libraryTitle?: string;
    bookTitle?: string;
  },
): { title: string; subtitle?: string } | null {
  switch (tab) {
    case 'walkman': return { title: trans('hdr.walkman'), subtitle: trans('hdr.walkmanSub') };
    case 'subtitles': return { title: trans('hdr.subtitles'), subtitle: trans('hdr.subtitlesSub') };
    case 'bilingual': return { title: trans('hdr.bilingual'), subtitle: trans('hdr.bilingualSub') };
    case 'profile': return { title: trans('hdr.profile'), subtitle: trans('hdr.profileSub') };
    case 'stats': return { title: trans('hdr.analytics'), subtitle: trans('hdr.analyticsSub') };
    case 'learning-model': return { title: trans('lm.title'), subtitle: trans('lm.sub') };
    case 'review-settings': return { title: trans('rev.title'), subtitle: trans('rev.sub') };
    case 'playback': return { title: trans('playset.title'), subtitle: trans('playset.sub') };
    case 'languages': return { title: trans('lang.title'), subtitle: trans('lang.sub') };
    case 'settings': return { title: trans('settings.title'), subtitle: trans('settings.sub') };
    case 'about': return { title: trans('about.title'), subtitle: trans('about.sub') };
    case 'admin': return { title: trans('hdr.admin'), subtitle: trans('hdr.adminSub') };
    case 'daily-reading': return { title: trans('home.dailyReading.title'), subtitle: trans('home.dailyReading.pageSubtitle') };
    case 'orch-audio': return { title: trans('orchAudio.title'), subtitle: trans('orchAudio.subtitle') };
    case 'shelf': return { title: context.wordGroupTitle || trans('library.title'), subtitle: trans('library.subtitle') };
    case 'social': return { title: trans('bc.social') };
    case 'auth': return { title: trans('bc.auth') };
    case 'content-list': return context.contentListKind ? { title: trans(`content.section.${context.contentListKind}`) } : null;
    case 'library': return context.libraryTitle ? { title: context.libraryTitle } : null;
    case 'book-reader': return context.bookTitle ? { title: context.bookTitle } : null;
    default: return null;
  }
}

export interface WordNewWordGroupRoute {
  matched: boolean;
  groupId: string | null;
}

function hashPath(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0] ?? '';
}

function hashQuery(hash: string): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '');
}

function itemRouteHash(route: string, itemId?: string | null, query?: URLSearchParams): string {
  const path = itemId ? `#/${route}/${encodeURIComponent(itemId)}` : `#/${route}`;
  const search = query?.toString();
  return search ? `${path}?${search}` : path;
}

function itemRouteId(route: string, hash: string): string | null {
  const path = hashPath(hash);
  const prefix = `${route}/`;

  return path.startsWith(prefix)
    ? decodeURIComponent(path.slice(prefix.length)).trim() || null
    : null;
}

/** The tab an item-route hash (`#/<tab>`, `#/<tab>/<id>`, `#/<tab>?...`) belongs to. */
export function itemRouteTab(hash: string): WordNewTab | null {
  const path = hashPath(hash);
  return ITEM_ROUTE_TABS.find((tab) => path === tab || path.startsWith(`${tab}/`)) ?? null;
}

export function dailyReadingHash(articleId?: string | null): string {
  return itemRouteHash(WORDNEW_HASH_ROUTES.dailyReading, articleId);
}

export function dailyReadingArticleId(hash: string): string | null {
  return itemRouteId(WORDNEW_HASH_ROUTES.dailyReading, hash);
}

export interface WordNewOrchAudioRoute {
  itemId: string | null;
  source: string | null;
  page: number;
}

export function orchAudioHash(route: Partial<WordNewOrchAudioRoute> = {}): string {
  const query = new URLSearchParams();
  if (!route.itemId && route.source) query.set('source', route.source);
  if (!route.itemId && route.page && route.page > 1) query.set('page', String(route.page));
  return itemRouteHash(WORDNEW_HASH_ROUTES.orchAudio, route.itemId, query);
}

export function parseOrchAudioHash(hash: string): WordNewOrchAudioRoute {
  const query = hashQuery(hash);
  return {
    itemId: itemRouteId(WORDNEW_HASH_ROUTES.orchAudio, hash),
    source: query.get('source') || null,
    page: Math.max(1, parseInt(query.get('page') || '1', 10) || 1),
  };
}

export function navigateToOrchAudio(route: Partial<WordNewOrchAudioRoute> = {}): void {
  const nextHash = orchAudioHash(route);

  if (typeof window === 'undefined' || window.location.hash === nextHash) return;
  window.location.hash = nextHash;
}

export function wordGroupHash(groupId?: string | null): string {
  return groupId
    ? `#/${WORDNEW_HASH_ROUTES.wordGroups}/${encodeURIComponent(groupId)}`
    : `#/${WORDNEW_HASH_ROUTES.wordGroups}`;
}

export function navigateToWordGroup(groupId: string): void {
  const nextHash = wordGroupHash(groupId);

  if (typeof window === 'undefined' || window.location.hash === nextHash) return;
  window.location.hash = nextHash;
}

export function parseWordGroupHash(hash: string): WordNewWordGroupRoute {
  const path = hashPath(hash);
  const prefix = `${WORDNEW_HASH_ROUTES.wordGroups}/`;

  if (path === WORDNEW_HASH_ROUTES.wordGroups) return { matched: true, groupId: null };
  if (!path.startsWith(prefix)) return { matched: false, groupId: null };
  return {
    matched: true,
    groupId: decodeURIComponent(path.slice(prefix.length)).trim() || null,
  };
}
