import React from 'react';
import { RefreshCw, ListChecks, Eye } from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock, EmptyState } from '../../common';
import VocabAssistQueuesPanel from '../VocabAssistQueuesPanel';
import type { AssistOverviewResponse } from '@/core/integrations/laravel';
import type { GlobalQueuePositionTaskAlias } from '@/core/contracts/QueueCenterContract';

type TtsQueueDrillParams = {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  type?: GlobalQueuePositionTaskAlias;
};

interface TtsQueueTabProps {
  queueStats: any;
  loadingQueueStats: boolean;
  autoRefreshQueue: boolean;
  setAutoRefreshQueue: (v: boolean) => void;
  loadQueueStats: () => void;
  openTtsQueueDrill: (label: string, params: TtsQueueDrillParams) => void;
  assistOverview: AssistOverviewResponse | null;
  loadingAssistOverview: boolean;
  loadAssistOverview: () => void;
  openAssistCategoryDrill: (label: string, category: string, status?: 'pending' | 'processing' | 'completed' | 'failed' | 'leased') => void;
  setLogsDockOpen: (v: boolean) => void;
  t: {
    tts_queue_management: string;
    auto_refresh: string;
    refresh: string;
    status_statistics: string;
    dictionary_tts_types: string;
    dictionary_tts_description: string;
    audio_type_word: string;
    audio_type_sentence: string;
    audio_type_article: string;
    additional_information: string;
    current_concurrent: string;
    total_success: string;
    total_retries: string;
    no_queue_statistics: string;
    logs_moved_hint: string;
    open_logs_dock: string;
    queue_drill: {
      pending: string;
      processing: string;
      completed: string;
      failed: string;
      total: string;
    };
  };
}

/** TTS Queue tab body: worker queues (Laravel), queue management card, stat cards, logs hint. */
const TtsQueueTab: React.FC<TtsQueueTabProps> = ({
  queueStats,
  loadingQueueStats,
  autoRefreshQueue,
  setAutoRefreshQueue,
  loadQueueStats,
  openTtsQueueDrill,
  assistOverview,
  loadingAssistOverview,
  loadAssistOverview,
  openAssistCategoryDrill,
  setLogsDockOpen,
  t,
}) => {
  return (
      <>
      {/* Worker queues — Laravel assist/overview only (no pycore :59000 on laravel-manager). */}
      <VocabAssistQueuesPanel
        overview={assistOverview}
        loading={loadingAssistOverview}
        onRefresh={loadAssistOverview}
        onDrill={openAssistCategoryDrill}
      />

      {/* TTS Queue Management Section */}
      <div className={`${commonClasses.card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">{t.tts_queue_management}</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefreshQueue}
                onChange={(e) => setAutoRefreshQueue(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <label htmlFor="auto-refresh" className="text-xs text-slate-600 dark:text-slate-400">
                {t.auto_refresh}
              </label>
            </div>
          </div>
          <button
            onClick={loadQueueStats}
            disabled={loadingQueueStats}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingQueueStats ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
        </div>

        {queueStats ? (
          <div className="space-y-4">
            {/* Status Statistics */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t.status_statistics}</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill(t.queue_drill.pending, { status: 'pending' })}
                  className="text-left bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                    {queueStats.by_status?.pending || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.queue_drill.pending}</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill(t.queue_drill.processing, { status: 'processing' })}
                  className="text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    {queueStats.by_status?.processing || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.queue_drill.processing}</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill(t.queue_drill.completed, { status: 'completed' })}
                  className="text-left bg-green-50 dark:bg-green-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                    {queueStats.by_status?.completed || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.queue_drill.completed}</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill(t.queue_drill.failed, { status: 'failed' })}
                  className="text-left bg-red-50 dark:bg-red-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                    {queueStats.by_status?.failed || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.queue_drill.failed}</div>
                </button>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                    {queueStats.total || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.queue_drill.total}</div>
                </div>
              </div>
            </div>

            {/* Type Statistics — dictionary canonical tables (word / article); sentence_audio is under Worker Queues */}
            {queueStats.by_type && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t.dictionary_tts_types}</h4>
                <p className="text-[10px] text-slate-400 mb-3">
                  {t.dictionary_tts_description}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill(t.audio_type_word, { type: 'word' })}
                    className="text-left bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                      {queueStats.by_type.word || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{t.audio_type_word}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill(t.audio_type_sentence, { type: 'sentence' })}
                    className="text-left bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                      {queueStats.by_type.sentence || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{t.audio_type_sentence}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill(t.audio_type_article, { type: 'article' })}
                    className="text-left bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-pink-700 dark:text-pink-400 flex items-center gap-1">
                      {queueStats.by_type.article || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{t.audio_type_article}</div>
                  </button>
                </div>
              </div>
            )}

            {/* Additional Stats - Always show if data exists */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t.additional_information}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                    {queueStats.current_concurrent ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.current_concurrent}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {queueStats.total_success ?? queueStats.by_status?.completed ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.total_success}</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {queueStats.total_retries ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.total_retries}</div>
                </div>
              </div>
            </div>

            {/* Recent Logs — moved to the floating bottom-left dock (<TtsLogsDock/>) */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                {t.logs_moved_hint}
              </p>
              <button
                type="button"
                onClick={() => setLogsDockOpen(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
              >
                {t.open_logs_dock}
              </button>
            </div>
          </div>
        ) : loadingQueueStats ? (
          <LoadingBlock />
        ) : (
          <EmptyState message={t.no_queue_statistics} />
        )}
      </div>
      </>
  );
};

export default TtsQueueTab;
