/**
 * PcContentPage — the single laravel_main DATA-INGEST surface. ONE sidebar tab
 * hosting every "add data to Laravel" feature as sub-tabs:
 *   - Subtitles    (PcVideoExtractPage) — video → subtitle (.srt) extraction,
 *                  per-cue multi-language correspondence, sync as source_type='subtitle'.
 *   - Books        (PcBooksPage)        — add book files/folders, analyze,
 *                  chapter→sentence correspondence tree, sync as source_type='book';
 *                  also hosts the advanced CoreBook enrichment (PcCoreBookPanel:
 *                  open/convert a portable book, add a language (batched AI), fill
 *                  audio (TTS), submit to laravel_main) as a collapsible section.
 *   - Add Document (PcAddDocumentView)  — upload a doc/text file → analyze →
 *                  ingest into the shared sentence library as source_type='document'.
 *
 * STATE RETENTION (the requirement): the active sub-tab is reflected in the URL
 * (?tab=…) AND mirrored to localStorage, so the legacy routes (/books,
 * /video-extract and /corebook→books) redirect here with the matching ?tab=
 * and a page refresh restores the same sub-tab. Crucially, sub-views are KEEP-ALIVE
 * mounted: once a sub-tab has been visited it stays mounted (just hidden via
 * `display:none`) instead of unmounting, so in-progress UI (selections, analysis
 * results, running jobs, sync progress) is preserved when switching sub-tabs.
 * Across a FULL reload each sub-view additionally re-hydrates its progress from the
 * backend idempotently, so the page returns to where the user left off.
 *
 * Labels are hardcoded English to match the embedded pages (no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Library, BookOpen, Captions, FileText, type LucideIcon,
} from 'lucide-react';
import PcBooksPage from './PcBooksPage';
import PcVideoExtractPage from './PcVideoExtractPage';
import PcAddDocumentView from '../components/PcAddDocumentView';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

type ContentTab = 'subtitles' | 'books' | 'document';

const TAB_ORDER: ContentTab[] = ['subtitles', 'books', 'document'];

const isTab = (v: string | null): v is ContentTab =>
  v != null && (TAB_ORDER as string[]).includes(v);

interface TabDef { key: ContentTab; label: string; hint: string; Icon: LucideIcon; }

const TABS: TabDef[] = [
  { key: 'subtitles', label: 'Subtitles', hint: 'Extract subtitles from video and sync the per-cue multi-language correspondence to Laravel.', Icon: Captions },
  { key: 'books', label: 'Books', hint: 'Add book files or folders, analyze them, and sync to Laravel — plus the advanced CoreBook enrichment (AI languages, audio, whole/partial submit).', Icon: BookOpen },
  { key: 'document', label: 'Add Document', hint: 'Upload a document or text file, analyze it, and ingest it into the shared sentence library.', Icon: FileText },
];

// Each sub-view's own outer chrome: Books and Video-Extract render
// their own `p-3 sm:p-6 md:p-8` padding; Add-Document does not, so it gets a padded
// wrapper here. (CoreBook now lives inside Books as an advanced section.)
const renderSubView = (key: ContentTab): React.ReactNode => {
  switch (key) {
    case 'subtitles': return <PcVideoExtractPage />;
    case 'books': return <PcBooksPage />;
    case 'document': return <div className="p-3 sm:p-6 md:p-8"><PcAddDocumentView /></div>;
  }
};

const PcContentPage: React.FC = () => {
  // Initial tab: ?tab= (set by the legacy-route redirects) wins over the
  // last-used tab persisted in localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): ContentTab => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) return fromUrl;
    const saved = StorageManager.getRaw(StorageKeys.PYCORE_CONTENT_TAB);
    return isTab(saved) ? saved : 'subtitles';
  })();
  const [tab, setTab] = useState<ContentTab>(initialTab);
  useEffect(() => { StorageManager.setRaw(StorageKeys.PYCORE_CONTENT_TAB, tab); }, [tab]);

  // Keep-alive set: a sub-tab is mounted once visited and never unmounted, so its
  // in-progress UI survives switching to another sub-tab (it is only hidden).
  const [mounted, setMounted] = useState<Set<ContentTab>>(() => new Set([initialTab]));
  useEffect(() => {
    setMounted((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  // A legacy-slug redirect can land here while the page is ALREADY mounted
  // (only ?tab= changes, no remount) — keep the tab in sync with the URL.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  const switchTab = useCallback((next: ContentTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  const activeHint = TABS.find((d) => d.key === tab)!.hint;

  return (
    <div className="min-w-0 max-w-full">
      {/* Sticky page chrome — title + sub-tabs pinned below PcTopBar. */}
      <div
        className="sticky top-0 z-20 px-6 md:px-8 py-3 flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl"
        style={{ paddingRight: 'max(1.5rem, var(--shell-dock-right-gutter, 264px))' }}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Library className="w-5 h-5 text-rose-500" /> Content
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeHint}</p>
        </div>

        {/* sub-tab bar */}
        <div className="flex flex-wrap rounded-xl pc-glass overflow-hidden w-full sm:w-auto self-start">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`relative px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                tab === key
                  ? 'text-rose-500'
                  : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
              {tab === key && (
                <motion.span
                  layoutId="pc-content-subtab"
                  className="absolute inset-0 -z-10 bg-rose-500/15 rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Keep-alive sub-views: every visited tab stays mounted (hidden when
          inactive) so its progress/working UI is preserved across switches. */}
      {TAB_ORDER.filter((key) => mounted.has(key)).map((key) => (
        <div key={key} className={tab === key ? '' : 'hidden'} aria-hidden={tab !== key}>
          {renderSubView(key)}
        </div>
      ))}
    </div>
  );
};

export default PcContentPage;
