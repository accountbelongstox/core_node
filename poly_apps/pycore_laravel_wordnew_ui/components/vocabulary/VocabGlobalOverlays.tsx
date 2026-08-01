import React from 'react';
import VocabularyWordListModal from './VocabularyWordListModal';
import VocabularyLibraryDetail from './VocabularyLibraryDetail';
import TtsLogsDock from './TtsLogsDock';
import PaginatedListModal, { type PaginatedListColumn, type PaginatedListFetcher } from './PaginatedListModal';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';
import { ConfirmModal } from '../admin';
import type { VocabularyStatisticsWordRow, VocabularyWordsPagination } from '../../apps/laravel-manager/uiTypes';

/** Drill-down descriptor shared by every clickable stat (see container). */
interface StatDrill {
  title: string;
  subtitle?: string;
  fetchPage: PaginatedListFetcher;
  columns?: PaginatedListColumn[];
  renderDetail?: (row: any, absoluteIndex: number) => React.ReactNode;
  wide?: boolean;
  reloadKey: string;
}

export interface VocabGlobalOverlaysProps {
  // Word List Modal
  wordModalOpen: boolean;
  setWordModalOpen: (open: boolean) => void;
  wordModalLanguage: string;
  wordModalCache: Record<string, { page: number; perPage: number }>;
  setWordModalCache: React.Dispatch<
    React.SetStateAction<Record<string, { page: number; perPage: number }>>
  >;
  loadWordModal: (
    language: string,
    page: number,
    perPage: number
  ) => Promise<{
    words: VocabularyStatisticsWordRow[];
    pagination: VocabularyWordsPagination | null;
  }>;

  // Library Words detail (Portal-wrapped)
  libraryWordsModalOpen: boolean;
  activeLibrary: any | null;
  setLibraryWordsModalOpen: (open: boolean) => void;
  selectedLanguage: string;
  getLibraryPageCacheKey: (language: string, libraryId: number | string) => string;
  playWordAudio: (url: string, label?: string) => void;
  renderWordDetail: (row: any) => React.ReactNode;

  // Floating Recent-Logs dock
  logsDockOpen: boolean;
  setLogsDockOpen: React.Dispatch<React.SetStateAction<boolean>>;
  queueStats: any;
  loadingQueueStats: boolean;
  autoRefreshQueue: boolean;
  setAutoRefreshQueue: (value: boolean) => void;
  loadQueueStats: () => void;

  // Clickable-stat drill-down
  statDrill: StatDrill | null;
  setStatDrill: (value: StatDrill | null) => void;

  // Library deletion confirm
  libraryToDelete: any | null;
  setLibraryToDelete: (value: any | null) => void;
  deletingLibrary: boolean;
  handleDeleteLibrary: () => void;

  // i18n (vocabulary section)
  t: any;
}

/**
 * VocabGlobalOverlays — presentational shell grouping the always-mounted
 * overlays that live after the tab content: the word-list modal, the
 * Portal-wrapped library detail, the floating TTS logs dock, the shared
 * stat drill-down modal and the library-delete confirm dialog. All state,
 * handlers and render-prop factories stay in the container and arrive here as
 * props; this component owns no markup of its own beyond these mounts.
 */
const VocabGlobalOverlays: React.FC<VocabGlobalOverlaysProps> = ({
  wordModalOpen,
  setWordModalOpen,
  wordModalLanguage,
  wordModalCache,
  setWordModalCache,
  loadWordModal,
  libraryWordsModalOpen,
  activeLibrary,
  setLibraryWordsModalOpen,
  selectedLanguage,
  getLibraryPageCacheKey,
  playWordAudio,
  renderWordDetail,
  logsDockOpen,
  setLogsDockOpen,
  queueStats,
  loadingQueueStats,
  autoRefreshQueue,
  setAutoRefreshQueue,
  loadQueueStats,
  statDrill,
  setStatDrill,
  libraryToDelete,
  setLibraryToDelete,
  deletingLibrary,
  handleDeleteLibrary,
  t,
}) => {
  return (
    <>
      {/* Word List Modal – requests paginated words by language when opened */}
      <VocabularyWordListModal
        open={wordModalOpen}
        onClose={() => setWordModalOpen(false)}
        language={wordModalLanguage}
        fetchWords={loadWordModal}
        initialPage={wordModalCache[wordModalLanguage]?.page ?? 1}
        initialPerPage={wordModalCache[wordModalLanguage]?.perPage ?? 100}
        onPageChange={(lang, page, perPage) => {
          setWordModalCache((prev) => ({ ...prev, [lang]: { page, perPage } }));
        }}
      />

      {/* Library Words Modal — upgraded detail view (dashboard + virtualized
          list + per-row expand + fullscreen). The detail component owns its own
          fetching/paging/stats; it can go full-viewport (Esc restores/closes). */}
      {libraryWordsModalOpen && activeLibrary && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
            <VocabularyLibraryDetail
              library={activeLibrary}
              onClose={() => setLibraryWordsModalOpen(false)}
              playWordAudio={playWordAudio}
              renderWordDetail={renderWordDetail}
              pageCacheKey={getLibraryPageCacheKey(selectedLanguage || 'default', activeLibrary.id)}
            />
          </div>
        </Portal>
      )}

      {/* Floating Recent-Logs dock (bottom-left; the global log dock owns bottom-right).
          Rendered unconditionally so the pill badges stay live while collapsed. */}
      <TtsLogsDock
        open={logsDockOpen}
        onToggle={() => setLogsDockOpen((v) => !v)}
        queueStats={queueStats}
        loading={loadingQueueStats}
        autoRefresh={autoRefreshQueue}
        onAutoRefreshChange={setAutoRefreshQueue}
        onRefresh={loadQueueStats}
        t={t}
      />

      {/* Clickable-stat drill-down (TTS queue / dictionary words / libraries / language) */}
      {statDrill && (
        <PaginatedListModal
          open={!!statDrill}
          onClose={() => setStatDrill(null)}
          title={statDrill.title}
          subtitle={statDrill.subtitle}
          fetchPage={statDrill.fetchPage}
          columns={statDrill.columns}
          renderDetail={statDrill.renderDetail}
          wide={statDrill.wide}
          reloadKey={statDrill.reloadKey}
        />
      )}

      {/* Library deletion confirm */}
      <ConfirmModal
        isOpen={!!libraryToDelete}
        onClose={() => {
          if (!deletingLibrary) setLibraryToDelete(null);
        }}
        onConfirm={handleDeleteLibrary}
        title={t.delete_library}
        message={t.delete_library_confirm.replace('{name}', libraryToDelete?.name || `#${libraryToDelete?.id ?? ''}`)}
        confirmText={t.delete_library}
        cancelText={t.cancel}
        variant="danger"
        loading={deletingLibrary}
      />
    </>
  );
};

export default VocabGlobalOverlays;
