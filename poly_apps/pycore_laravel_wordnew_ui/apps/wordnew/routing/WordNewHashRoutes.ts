import {
  AudioLines, BarChart3, BookOpen, BrainCircuit, CalendarClock, Captions, FileText,
  FlaskConical, Globe2, GraduationCap, HardDrive, Headphones, Info, Languages, Layers,
  LayoutGrid, Library, LibraryBig, LogIn, Newspaper, Settings, ShieldCheck,
  SlidersHorizontal, UserRound, Users, type LucideIcon,
} from 'lucide-react';
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
  | 'learning-model' | 'review-settings' | 'playback' | 'cache' | 'book-reader' | 'content-list' | 'library' | 'about'
  | 'daily-reading' | 'orch-audio' | 'admin';

export const WORDNEW_TABS: readonly WordNewTab[] = Object.freeze([
  'home', 'shelf', 'practice', 'labs', 'settings', 'walkman', 'subtitles',
  'stats', 'bilingual', 'social', 'profile', 'auth', 'languages',
  'learning-model', 'review-settings', 'playback', 'cache', 'book-reader', 'content-list', 'about',
  'daily-reading', 'orch-audio', 'admin',
]);

export interface WordNewPageHeader {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

const CONTENT_KIND_ICONS: Record<WfNewContentKind, LucideIcon> = {
  word: Layers,
  book: BookOpen,
  subtitle: Captions,
  library: LibraryBig,
  document: FileText,
};

/** Header identity of the current page: the icon the header renders, plus the
 *  title/subtitle it exposes as tooltip and accessible label. Home has none. */
export function wordNewPageHeader(
  tab: WordNewTab,
  trans: (key: string, replacements?: Record<string, string | number>) => string,
  context: {
    contentListKind: WfNewContentKind | null;
    wordGroupTitle?: string;
    libraryTitle?: string;
    bookTitle?: string;
  },
): WordNewPageHeader | null {
  switch (tab) {
    case 'home': return null;
    case 'walkman': return { icon: Headphones, title: trans('hdr.walkman'), subtitle: trans('hdr.walkmanSub') };
    case 'subtitles': return { icon: Captions, title: trans('hdr.subtitles'), subtitle: trans('hdr.subtitlesSub') };
    case 'bilingual': return { icon: Languages, title: trans('hdr.bilingual'), subtitle: trans('hdr.bilingualSub') };
    case 'profile': return { icon: UserRound, title: trans('hdr.profile'), subtitle: trans('hdr.profileSub') };
    case 'stats': return { icon: BarChart3, title: trans('hdr.analytics'), subtitle: trans('hdr.analyticsSub') };
    case 'learning-model': return { icon: BrainCircuit, title: trans('lm.title'), subtitle: trans('lm.sub') };
    case 'review-settings': return { icon: CalendarClock, title: trans('rev.title'), subtitle: trans('rev.sub') };
    case 'playback': return { icon: SlidersHorizontal, title: trans('playset.title'), subtitle: trans('playset.sub') };
    case 'cache': return { icon: HardDrive, title: trans('cachePage.title'), subtitle: trans('cachePage.subtitle') };
    case 'languages': return { icon: Globe2, title: trans('lang.title'), subtitle: trans('lang.sub') };
    case 'settings': return { icon: Settings, title: trans('settings.title'), subtitle: trans('settings.sub') };
    case 'about': return { icon: Info, title: trans('about.title'), subtitle: trans('about.sub') };
    case 'admin': return { icon: ShieldCheck, title: trans('hdr.admin'), subtitle: trans('hdr.adminSub') };
    case 'daily-reading': return { icon: Newspaper, title: trans('home.dailyReading.title'), subtitle: trans('home.dailyReading.pageSubtitle') };
    case 'orch-audio': return { icon: AudioLines, title: trans('orchAudio.title'), subtitle: trans('orchAudio.subtitle') };
    case 'shelf': return { icon: Library, title: context.wordGroupTitle || trans('library.title'), subtitle: trans('library.subtitle') };
    case 'practice': return { icon: GraduationCap, title: trans('nav.practice') };
    case 'labs': return { icon: FlaskConical, title: trans('nav.tools') };
    case 'social': return { icon: Users, title: trans('nav.social') };
    case 'auth': return { icon: LogIn, title: trans('bc.auth') };
    case 'content-list': return {
      icon: context.contentListKind ? CONTENT_KIND_ICONS[context.contentListKind] : LayoutGrid,
      title: context.contentListKind ? trans(`content.section.${context.contentListKind}`) : '',
    };
    case 'library': return { icon: LibraryBig, title: context.libraryTitle || '' };
    case 'book-reader': return { icon: BookOpen, title: context.bookTitle || '' };
    default: return { icon: LayoutGrid, title: '' };
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

/** `compose`: the client compositions; `delivered`: pycore output delivered to Laravel. */
export type WordNewOrchAudioView = 'compose' | 'delivered';

export interface WordNewOrchAudioRoute {
  view: WordNewOrchAudioView;
  itemId: string | null;
  source: string | null;
  page: number;
}

const DELIVERED_ITEM_ID_RE = /^[a-f0-9]{40}$/;

export function orchAudioHash(route: Partial<WordNewOrchAudioRoute> = {}): string {
  const query = new URLSearchParams();
  if (route.view === 'delivered') query.set('view', 'delivered');
  if (!route.itemId && route.source) query.set('source', route.source);
  if (!route.itemId && route.page && route.page > 1) query.set('page', String(route.page));
  return itemRouteHash(WORDNEW_HASH_ROUTES.orchAudio, route.itemId, query);
}

export function parseOrchAudioHash(hash: string): WordNewOrchAudioRoute {
  const query = hashQuery(hash);
  const itemId = itemRouteId(WORDNEW_HASH_ROUTES.orchAudio, hash);
  const view = query.get('view') === 'delivered' || (itemId !== null && DELIVERED_ITEM_ID_RE.test(itemId))
    ? 'delivered'
    : 'compose';
  return {
    view,
    itemId,
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
