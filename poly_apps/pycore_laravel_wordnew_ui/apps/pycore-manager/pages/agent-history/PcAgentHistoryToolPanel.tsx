import React, { useCallback, useEffect, useState } from 'react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  AgentHistoryFragmentKind,
  AgentHistorySessionSummary,
  AgentHistoryToolFragment,
} from '@/apps/pycore-manager/api';
import PcFloatingPanel from '../../components/PcFloatingPanel';
import PcPager from './PcPager';
import { TOOL_LABELS } from './presentation';

export type AgentHistoryToolPanelKind = AgentHistoryFragmentKind | 'sessions';

const PAGE_SIZE = 50;

/**
 * Floating drill-down for one tool card stat (提示词 / 吐字历史 / 已处理内容 /
 * 待处理内容 / 会话). Paginated via the DIFF read surface; opened instead of
 * scrolling to the page-bottom list.
 */
const PcAgentHistoryToolPanel: React.FC<{
  tk: (key: string) => string;
  tool: string;
  kind: AgentHistoryToolPanelKind;
  onClose: () => void;
}> = ({ tk, tool, kind, onClose }) => {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fragments, setFragments] = useState<AgentHistoryToolFragment[]>([]);
  const [sessions, setSessions] = useState<AgentHistorySessionSummary[]>([]);

  useEffect(() => {
    setPage(1);
  }, [tool, kind]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (kind === 'sessions') {
        const res = await pycoreApi.getAgentHistorySessionIdPages({ tool, page, pageSize: PAGE_SIZE });
        if (!res.success || !res.data) {
          setError(res.error || tk('loadError'));
          return;
        }
        setTotal(Number(res.data.total || 0));
        const ids = (res.data.items || []).map((item) => item.id);
        if (ids.length === 0) {
          setSessions([]);
          return;
        }
        const rows = await pycoreApi.getAgentHistorySessionPage(ids);
        if (rows.success && rows.data) setSessions(rows.data.items || []);
        else setError(rows.error || tk('loadError'));
        return;
      }
      const res = await pycoreApi.getAgentHistoryToolFragmentIdPages({ tool, kind, page, pageSize: PAGE_SIZE });
      if (!res.success || !res.data) {
        setError(res.error || tk('loadError'));
        return;
      }
      setTotal(Number(res.data.total || 0));
      const ids = (res.data.items || []).map((item) => item.id);
      if (ids.length === 0) {
        setFragments([]);
        return;
      }
      const rows = await pycoreApi.getAgentHistoryToolFragmentPage(tool, kind, ids);
      if (rows.success && rows.data) setFragments(rows.data.items || []);
      else setError(rows.error || tk('loadError'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tk('loadError'));
    } finally {
      setLoading(false);
    }
  }, [kind, page, tk, tool]);

  useEffect(() => {
    void load();
  }, [load]);

  const kindLabelKey: Record<AgentHistoryToolPanelKind, string> = {
    prompts: 'promptCount',
    replies: 'replyCount',
    processed: 'processedRecords',
    pending: 'pendingRecords',
    sessions: 'sessionCount',
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PcFloatingPanel
      open
      onClose={onClose}
      closeLabel={tk('close')}
      title={`${TOOL_LABELS[tool] || tool} · ${tk(kindLabelKey[kind])}`}
      subtitle={`${total} ${tk(kindLabelKey[kind])}`}
      footer={totalPages > 1 ? <PcPager page={page} totalPages={totalPages} onChange={setPage} tk={tk} /> : undefined}
    >
      {loading && <div className="py-8 text-center text-sm text-slate-500">{tk('loading')}</div>}
      {!loading && error && <div className="py-8 text-center text-sm text-red-500">{error}</div>}
      {!loading && !error && kind === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 && <div className="py-8 text-center text-sm text-slate-500">{tk('empty')}</div>}
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-lg border border-slate-200 dark:border-white/10 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {session.title || session.id}
                </span>
                <span className="shrink-0 text-[10px] font-mono text-slate-400">{session.started_at}</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-slate-500">
                {session.project || ''} · {session.prompt_count} {tk('promptCount')}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && kind !== 'sessions' && (
        <div className="space-y-3">
          {fragments.length === 0 && <div className="py-8 text-center text-sm text-slate-500">{tk('empty')}</div>}
          {fragments.map((fragment) => (
            <div
              key={fragment.id}
              className="rounded-lg border border-slate-200 dark:border-white/10 p-3"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                <span>{fragment.kind === 'prompt' ? tk('promptCount') : tk('replyCount')}</span>
                <span>{fragment.time}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-200">
                {fragment.text || ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </PcFloatingPanel>
  );
};

export default PcAgentHistoryToolPanel;
