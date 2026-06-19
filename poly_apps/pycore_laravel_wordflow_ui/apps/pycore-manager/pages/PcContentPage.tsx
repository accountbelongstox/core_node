/**
 * PcContentPage — the unified "Content" page, merging the three former ingest
 * pages into ONE tabbed surface:
 *   - Books        (PcBooksPage)        — add book files/folders, analyze,
 *                  language multi-select + chapter→sentence correspondence tree,
 *                  sync to Laravel as source_type='book'.
 *   - Subtitles    (PcVideoExtractPage) — video → subtitle (.srt) extraction,
 *                  language multi-select + per-cue multi-language correspondence,
 *                  sync to Laravel as source_type='subtitle'.
 *   - Add Document (PcAddDocumentView)  — upload a doc/text file → analyze →
 *                  ingest into the shared sentence library as source_type='document'.
 *
 * The active sub-tab is reflected in the URL (?tab=books|subtitles|document) so
 * the legacy routes /books and /video-extract can redirect here with the matching
 * ?tab= (see PcApp.tsx). Sub-tab switching is animated with framer-motion; only
 * the active sub-view is mounted (each owns its own polling/WS). Labels are
 * hardcoded English to match the Books/Video pages (no `t` object on those pages).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Library, BookOpen, Captions, FileText, type LucideIcon } from 'lucide-react';
import { SUBTAB_MOTION } from '../components/PcAiShared';
import PcBooksPage from './PcBooksPage';
import PcVideoExtractPage from './PcVideoExtractPage';
import PcAddDocumentView from '../components/PcAddDocumentView';

type ContentTab = 'books' | 'subtitles' | 'document';

const TAB_KEY = 'pc_content_tab';

const isTab = (v: string | null): v is ContentTab =>
  v === 'books' || v === 'subtitles' || v === 'document';

interface TabDef { key: ContentTab; label: string; hint: string; Icon: LucideIcon; }

const TABS: TabDef[] = [
  { key: 'books', label: 'Books', hint: 'Add book files or folders, analyze them, and sync to Laravel as a sentence source.', Icon: BookOpen },
  { key: 'subtitles', label: 'Subtitles', hint: 'Extract subtitles from video and sync the per-cue multi-language correspondence to Laravel.', Icon: Captions },
  { key: 'document', label: 'Add Document', hint: 'Upload a document or text file, analyze it, and ingest it into the shared sentence library.', Icon: FileText },
];

const PcContentPage: React.FC = () => {
  // Initial tab: ?tab= (set by the legacy-route redirects) wins over the
  // last-used tab persisted in localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ContentTab>(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(TAB_KEY);
    return isTab(saved) ? saved : 'books';
  });
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

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
        <div className="flex rounded-xl pc-glass overflow-hidden w-full sm:w-auto self-start">
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

      {/* animated sub-view swap; only the active sub-view is mounted */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...SUBTAB_MOTION}>
          {tab === 'books' && <PcBooksPage />}
          {tab === 'subtitles' && <PcVideoExtractPage />}
          {tab === 'document' && (
            <div className="p-6 md:p-8">
              <PcAddDocumentView />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PcContentPage;
