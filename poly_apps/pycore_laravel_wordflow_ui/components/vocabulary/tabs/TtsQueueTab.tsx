import React from 'react';
import { RefreshCw, ListChecks, Eye } from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, EmptyState } from '../../common';
import VocabTtsEnginesStrip from '../VocabTtsEnginesStrip';

type TtsQueueDrillParams = {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  type?: 'word' | 'sentence' | 'article';
};

interface TtsQueueTabProps {
  queueStats: any;
  loadingQueueStats: boolean;
  autoRefreshQueue: boolean;
  setAutoRefreshQueue: (v: boolean) => void;
  loadQueueStats: () => void;
  openTtsQueueDrill: (label: string, params: TtsQueueDrillParams) => void;
  setLogsDockOpen: (v: boolean) => void;
  t: {
    logs_moved_hint: string;
    open_logs_dock: string;
  };
}

/** TTS Queue tab body: engines strip, queue management card, colored stat cards, logs-moved hint. */
const TtsQueueTab: React.FC<TtsQueueTabProps> = ({
  queueStats,
  loadingQueueStats,
  autoRefreshQueue,
  setAutoRefreshQueue,
  loadQueueStats,
  openTtsQueueDrill,
  setLogsDockOpen,
  t,
}) => {
  return (
      <>
      {/* TTS Engines status strip (pycore — polled, degrades gracefully) */}
      <VocabTtsEnginesStrip />

      {/* TTS Queue Management Section */}
      <div className={`${commonClasses.card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">TTS Queue Management</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefreshQueue}
                onChange={(e) => setAutoRefreshQueue(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <label htmlFor="auto-refresh" className="text-xs text-slate-600 dark:text-slate-400">
                Auto-refresh (5s)
              </label>
            </div>
          </div>
          <button
            onClick={loadQueueStats}
            disabled={loadingQueueStats}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingQueueStats ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {queueStats ? (
          <div className="space-y-4">
            {/* Status Statistics */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Status Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill('Pending', { status: 'pending' })}
                  className="text-left bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                    {queueStats.by_status?.pending || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Pending</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill('Processing', { status: 'processing' })}
                  className="text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    {queueStats.by_status?.processing || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Processing</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill('Completed', { status: 'completed' })}
                  className="text-left bg-green-50 dark:bg-green-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                    {queueStats.by_status?.completed || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Completed</div>
                </button>
                <button
                  type="button"
                  onClick={() => openTtsQueueDrill('Failed', { status: 'failed' })}
                  className="text-left bg-red-50 dark:bg-red-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                >
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                    {queueStats.by_status?.failed || 0}
                    <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Failed</div>
                </button>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                    {queueStats.total || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
                </div>
              </div>
            </div>

            {/* Type Statistics */}
            {queueStats.by_type && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Type Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill('Word', { type: 'word' })}
                    className="text-left bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                      {queueStats.by_type.word || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Word</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill('Sentence', { type: 'sentence' })}
                    className="text-left bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                      {queueStats.by_type.sentence || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Sentence</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTtsQueueDrill('Article', { type: 'article' })}
                    className="text-left bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
                  >
                    <div className="text-2xl font-bold text-pink-700 dark:text-pink-400 flex items-center gap-1">
                      {queueStats.by_type.article || 0}
                      <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Article</div>
                  </button>
                </div>
              </div>
            )}

            {/* Additional Stats - Always show if data exists */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Additional Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                    {queueStats.current_concurrent ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Current Concurrent</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {queueStats.total_success ?? queueStats.by_status?.completed ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total Success</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {queueStats.total_retries ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total Retries</div>
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
          <EmptyState message="No queue statistics available" />
        )}
      </div>
      </>
  );
};

export default TtsQueueTab;
