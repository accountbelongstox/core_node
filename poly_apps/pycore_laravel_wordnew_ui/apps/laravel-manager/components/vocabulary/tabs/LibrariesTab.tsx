import React from 'react';
import { Sliders, RefreshCw, BookOpen, CircleAlert, Trash2 } from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { laravelMediaUrl as mediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { LoadingBlock, EmptyState } from '../../common';
import { CollapsibleSection } from '../CollapsibleSection';
import ExistingBooksPanel from '../ExistingBooksPanel';
import ExistingDocumentsPanel from '../ExistingDocumentsPanel';
import BooksPanel from '../BooksPanel';
import VocabPosterStrip from '../VocabPosterStrip';
import VocabularyCoverManagerMenu from '../VocabularyCoverManagerMenu';

interface LibrariesTabProps {
  libraries: any[];
  loadingLibraries: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (v: string) => void;
  librariesFilterOpen: boolean;
  setLibrariesFilterOpen: (updater: (v: boolean) => boolean) => void;
  loadLibraries: () => void;
  loadLibraryWords: (library: any) => void;
  handleRetryCover: (library: any) => void;
  retryingCovers: Set<any>;
  setLibraryToDelete: (library: any) => void;
  t: {
    delete_library: string;
  };
}

/** Libraries tab body: language filter, books/poster panels, cover-manager header, and the library card grid. */
const LibrariesTab: React.FC<LibrariesTabProps> = ({
  libraries,
  loadingLibraries,
  selectedLanguage,
  setSelectedLanguage,
  librariesFilterOpen,
  setLibrariesFilterOpen,
  loadLibraries,
  loadLibraryWords,
  handleRetryCover,
  retryingCovers,
  setLibraryToDelete,
  t,
}) => {
  return (
      <>
      {/* Collapsible language-filter side panel (secondary settings) */}
      <CollapsibleSection
        title="Filters"
        icon={<Sliders className="w-4 h-4 text-indigo-500" />}
        open={librariesFilterOpen}
        onToggle={() => setLibrariesFilterOpen((v) => !v)}
        className="mb-4"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500 dark:text-slate-400">Language</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className={`${commonClasses.input} text-sm`}
          >
            <option value="english">English</option>
            <option value="chinese">Chinese</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="french">French</option>
            <option value="german">German</option>
            <option value="spanish">Spanish</option>
          </select>
          <button
            onClick={loadLibraries}
            disabled={loadingLibraries}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className={`w-4 h-4 ${loadingLibraries ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </CollapsibleSection>

      {/* Existing library — read-only browse of already-ingested books + the
          signed-in user's uploaded documents (GET /media/books, /media/documents). */}
      <ExistingBooksPanel />
      <ExistingDocumentsPanel />

      {/* Books / Add source — collapsible upload + analyze + ingest panel */}
      <BooksPanel />

      {/* Movie / TV poster pipeline status — mirrors the cover-status UI:
          provider key badges + per-type (books / subtitles) poster counts. */}
      <VocabPosterStrip />

      {/* Vocabulary Libraries Section */}
      <div className={`${commonClasses.card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Vocabulary Libraries
            <span className="text-xs font-normal text-slate-400 capitalize">· {selectedLanguage}</span>
          </h3>
          <div className="flex items-center gap-3">
            <VocabularyCoverManagerMenu onChanged={loadLibraries} />
            <button
              onClick={() => setLibrariesFilterOpen((v) => !v)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              Filters
            </button>
          </div>
        </div>

        {loadingLibraries ? (
          <LoadingBlock />
        ) : libraries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {libraries.map((library: any) => (
              <div
                key={library.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => loadLibraryWords(library)}
              >
                {library.image_url && (
                  <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={mediaUrl(library.image_url)}
                      alt={library.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {/* Failed cover: show WHY (error_message + attempts) and a per-
                    library Retry that re-queues it for pycore (pull-only). */}
                {library.cover?.status === 'failed' && (
                  <div
                    className="mb-3 px-2.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
                      <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span
                        className="flex-1 line-clamp-2 break-words"
                        title={library.cover.error_message || 'Cover generation failed.'}
                      >
                        {library.cover.error_message || 'Cover generation failed.'}
                        {typeof library.cover.attempts === 'number' && library.cover.attempts > 0 && (
                          <span className="text-red-500/80 dark:text-red-400/80">
                            {' '}({library.cover.attempts} attempt{library.cover.attempts === 1 ? '' : 's'})
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryCover(library);
                      }}
                      disabled={retryingCovers.has(library.id)}
                      className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 ${retryingCovers.has(library.id) ? 'animate-spin' : ''}`} />
                      Retry cover
                    </button>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{library.name}</h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLibraryToDelete(library);
                    }}
                    className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t.delete_library}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {library.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                    {library.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {library.word_count || 0} words
                  </span>
                  <div className="flex items-center gap-2">
                    {library.difficulty && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        library.difficulty === 'beginner'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : library.difficulty === 'intermediate'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>
                        {library.difficulty}
                      </span>
                    )}
                    {library.is_recommended && (
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
                {library.category && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Category: {library.category}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpen} message={`No libraries available for ${selectedLanguage}`} />
        )}
      </div>
      </>
  );
};

export default LibrariesTab;
