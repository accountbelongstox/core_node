import React from 'react';
import { ListChecks, RefreshCw, ChevronDown, CircleAlert } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { StatusBadge } from '../common';

/** Status → text colour for the collapsed-pill latest-entry one-liner. */
const ttsLogStatusText = (status: string | undefined): string =>
  status === 'failed' ? 'text-red-600 dark:text-red-400' :
  status === 'completed' ? 'text-green-600 dark:text-green-400' :
  status === 'processing' ? 'text-blue-600 dark:text-blue-400' :
  'text-yellow-600 dark:text-yellow-400';

export interface TtsLogsDockProps {
  open: boolean;
  onToggle: () => void;
  /** Polled queue-stats snapshot (shape comes from the backend, kept loose). */
  queueStats: any;
  loading: boolean;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  onRefresh: () => void;
  /** i18n strings (vocabulary section). */
  t: {
    recent_logs_dock: string;
    auto_refresh: string;
    refresh: string;
    failed: string;
    no_logs: string;
  };
}

/**
 * TtsLogsDock — page-local floating dock for the TTS queue "Recent Logs"
 * table, anchored bottom-LEFT (the global operation-log dock owns
 * bottom-right). Collapsed: a pill with live count / failed badges + the
 * latest entry. Expanded: the full 8-column log table in a scrollable panel.
 * `left-16 md:left-20` clears the fixed app sidebar (z-50, ~3.5–4rem wide);
 * z-[150] matches the global dock — above app chrome, below Portal overlays.
 */
const TtsLogsDock: React.FC<TtsLogsDockProps> = ({
  open,
  onToggle,
  queueStats,
  loading,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  t
}) => {
  const recentLogs: any[] = Array.isArray(queueStats?.recent_logs) ? queueStats.recent_logs : [];
  const logsCount: number = Number(queueStats?.logs_count) || recentLogs.length;
  const failedCount = recentLogs.filter((log: any) => log?.status === 'failed').length;
  const latest: any | null = recentLogs.length > 0 ? recentLogs[0] : null;

  return (
    <Portal lockScroll={false}>
      <div className="fixed bottom-3 left-16 md:left-20 z-[150] flex flex-col items-start pointer-events-none">
        {open && (
          <div className="pointer-events-auto mb-2 w-[min(960px,calc(100vw-6rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Header: title + auto-refresh + manual refresh + collapse */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {t.recent_logs_dock}{logsCount > 0 ? ` (${logsCount})` : ''}
              </span>
              <span className="flex-1" />
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => onAutoRefreshChange(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                {t.auto_refresh}
              </label>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                {t.refresh}
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t.recent_logs_dock}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body: the 8-column queue-log table (moved from the TTS Queue card) */}
            <div className="max-h-80 overflow-auto">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-4">{t.no_logs}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Content</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Language</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Priority</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Retries</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {recentLogs.map((log: any, index: number) => (
                      <React.Fragment key={log.id || index}>
                        <tr
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            log.status === 'failed' ? 'bg-red-50/50 dark:bg-red-900/10' :
                            log.status === 'completed' ? 'bg-green-50/50 dark:bg-green-900/10' :
                            log.status === 'processing' ? 'bg-blue-50/50 dark:bg-blue-900/10' :
                            ''
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                            {log.id}
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100 max-w-xs truncate" title={log.content_text}>
                            {log.content_text || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              log.task_type === 'word' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' :
                              log.task_type === 'sentence' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                              'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
                            }`}>
                              {log.task_type || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 uppercase">
                            {log.language || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              status={log.status || '-'}
                              withDot={false}
                              tone={
                                log.status === 'completed' ? 'success' :
                                log.status === 'failed' ? 'error' :
                                log.status === 'processing' ? 'running' :
                                'warning'
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {log.priority ? log.priority.toLocaleString() : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {log.retry_count !== undefined && log.retry_count > 0 ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                {log.retry_count}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {log.completed_at ? (
                              <span className="text-green-600 dark:text-green-400" title={log.completed_at}>
                                {new Date(log.completed_at).toLocaleString()}
                              </span>
                            ) : log.started_at ? (
                              <span className="text-blue-600 dark:text-blue-400" title={log.started_at}>
                                {new Date(log.started_at).toLocaleString()}
                              </span>
                            ) : log.requested_at ? (
                              <span className="text-yellow-600 dark:text-yellow-400" title={log.requested_at}>
                                {new Date(log.requested_at).toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                        {log.error_message && (
                          <tr className="bg-red-50/30 dark:bg-red-900/10">
                            <td colSpan={8} className="px-3 py-2">
                              <p className="text-xs text-red-700 dark:text-red-400">
                                <strong>Error:</strong> {log.error_message}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Collapsed pill — always visible; badges stay live via the parent's poll. */}
        <button
          type="button"
          onClick={onToggle}
          title={t.recent_logs_dock}
          className="pointer-events-auto flex items-center gap-2 max-w-[min(560px,calc(100vw-8rem))] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
        >
          <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200 flex-shrink-0">{t.recent_logs_dock}</span>
          <span className="px-1.5 py-px rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0">
            {logsCount}
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex-shrink-0">
              <CircleAlert className="w-3 h-3" />
              {failedCount} {t.failed}
            </span>
          )}
          {!open && latest && (
            <span className={`truncate font-mono ${ttsLogStatusText(latest.status)}`}>
              {latest.content_text || latest.status || '-'}
            </span>
          )}
        </button>
      </div>
    </Portal>
  );
};

export default TtsLogsDock;
