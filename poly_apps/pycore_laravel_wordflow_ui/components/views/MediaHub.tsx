/**
 * MediaHub — the single-explorer "Media" shell.
 *
 * Previously a 2-tab host that mounted MoviesBooksBrowser and MediaBrowser side by
 * side. This is now ONE explorer: a single top bar (a [Movies|Books|Files] segment
 * control + one shared search + a Refresh button) over a two-column body — a LEFT
 * library switch (<LibraryPanel>) and a RIGHT detail pane that keeps BOTH viewers
 * mounted (toggled with the `hidden` class) so in-flight <video>/<audio> playback
 * and the virtualized sentence list survive a selection change.
 *
 * The original MoviesBooksBrowser.tsx / MediaBrowser.tsx remain untouched as the
 * extraction source (forward-only). The initial segment is derived once from the
 * arrival hash so old deep-links land on the right segment.
 *
 * Guardrails: no try/catch here, no `||`/`??` — explicit ternaries.
 */
import React, { useState } from 'react';
import { Clapperboard, BookOpen, Film, RefreshCw, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Language, FileNode } from '../../types';
import type { Segment, Selection } from './media/mbShared';
import LibraryPanel from './media/LibraryPanel';
import MbSourceDetail from './media/MbSourceDetail';
import FileViewer from './media/FileViewer';

/** Pick the initial segment from the arrival hash: #/movies-books -> movies;
 *  legacy #/media -> files; anything else -> the richer movies library. */
const getInitialSegment = (): Segment => {
  const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
  if (hash.indexOf('movies') >= 0) return 'movies';
  if (hash.indexOf('media') >= 0) return 'files';
  return 'movies';
};

const MediaHub: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const { t } = useTranslation();

  const [segment, setSegment] = useState<Segment>(getInitialSegment);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [playlist, setPlaylist] = useState<FileNode[]>([]);

  const segments: { id: Segment; icon: LucideIcon; label: string }[] = [
    { id: 'movies', icon: Clapperboard, label: t('mediaHub.segMovies') },
    { id: 'books', icon: BookOpen, label: t('mediaHub.segBooks') },
    { id: 'files', icon: Film, label: t('mediaHub.segFiles') },
  ];

  // Switching segment starts a fresh explore: clear the current selection so the
  // RIGHT pane drops back to its empty prompt instead of showing a stale source/file.
  const handleSegment = (id: Segment) => {
    if (id === segment) return;
    setSegment(id);
    setSelection(null);
  };

  const isSource = selection !== null && selection.kind === 'source';
  const isFile = selection !== null && selection.kind === 'file';
  const sourceSel = isSource ? selection.source : null;
  const fileSel = isFile ? selection.file : null;

  return (
    <div className="flex flex-col h-full">
      {/* Single top bar: segment control + shared search + refresh. */}
      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          {segments.map((sg) => {
            const isActive = segment === sg.id;
            return (
              <button
                key={sg.id}
                onClick={() => handleSegment(sg.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-white/20 dark:to-white/5 text-indigo-600 dark:text-white border-indigo-500/20 dark:border-white/20 shadow-lg'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <sg.icon size={16} />
                {sg.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('mediaHub.searchPlaceholder')}
          className="flex-1 min-w-[180px] bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500/50"
        />

        <button
          onClick={() => setReloadSignal((n) => n + 1)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 border border-black/5 dark:border-white/10 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={t('mediaHub.refresh')}
        >
          <RefreshCw size={16} />
          {t('mediaHub.refresh')}
        </button>
      </div>

      {/* Two columns: LEFT library switch, RIGHT detail pane (both viewers mounted). */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-3">
        <div className="flex flex-col min-h-0">
          <LibraryPanel
            segment={segment}
            search={search}
            selection={selection}
            onSelect={setSelection}
            onPlaylist={setPlaylist}
            lang={lang}
            reloadSignal={reloadSignal}
          />
        </div>

        <div className="flex flex-col min-h-0 relative">
          {/* Source detail (movies/books) — visible only for a source selection. */}
          <div className={isSource ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <MbSourceDetail source={sourceSel} />
          </div>

          {/* File viewer — visible only for a file selection. */}
          <div className={isFile ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <FileViewer
              file={fileSel}
              playlist={playlist}
              onNavigate={(n) => setSelection({ kind: 'file', file: n })}
              lang={lang}
            />
          </div>

          {/* Neutral empty prompt when nothing is selected. */}
          {selection === null && (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Film size={40} className="opacity-30" />
              <p className="text-sm">{t('mediaHub.emptyPrompt')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaHub;
