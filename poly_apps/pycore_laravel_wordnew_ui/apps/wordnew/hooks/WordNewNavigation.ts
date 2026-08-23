import type { WfNewContentKind } from '../api';

/** Every navigable page/tab in the wordnew shell (drives the history stack). */
export type WordNewTab =
  | 'home' | 'shelf' | 'practice' | 'labs' | 'settings' | 'walkman'
  | 'subtitles' | 'stats' | 'bilingual' | 'social' | 'profile' | 'auth' | 'languages'
  | 'learning-model' | 'review-settings' | 'playback' | 'book-reader' | 'content-list' | 'library' | 'about'
  | 'daily-reading' | 'admin';

/**
 * Per-tab header (big title + optional subtitle) shown in the global nav beside
 * the back/logo control (WfNewNavLogo's fixed-width, overflow-hidden info block).
 * Returns null for pages with no header (home / practice / labs) so only the
 * logo shows. Dynamic pages (word group / content-list / library / book-reader) take their
 * title from the active route state.
 */
export function wfNewPageHeader(
  tab: WordNewTab,
  trans: (key: string, replacements?: Record<string, string | number>) => string,
  dyn: {
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
    case 'daily-reading': return {
      title: trans('home.dailyReading.title'),
      subtitle: trans('home.dailyReading.pageSubtitle'),
    };
    case 'shelf': return {
      title: dyn.wordGroupTitle || trans('library.title'),
      subtitle: trans('library.subtitle'),
    };
    case 'social': return { title: trans('bc.social') };
    case 'auth': return { title: trans('bc.auth') };
    case 'content-list':
      return dyn.contentListKind ? { title: trans(`content.section.${dyn.contentListKind}`) } : null;
    case 'library':
      return dyn.libraryTitle ? { title: dyn.libraryTitle } : null;
    case 'book-reader':
      return dyn.bookTitle ? { title: dyn.bookTitle } : null;
    default:
      return null;
  }
}

