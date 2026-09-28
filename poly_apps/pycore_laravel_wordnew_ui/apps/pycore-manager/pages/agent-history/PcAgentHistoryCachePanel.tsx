/**
 * Pycore-side new-prompt cache viewer (read-only).
 *
 * Shows the namespaced side cache that pycore fills while reading agents
 * (prompt_new_cache.py — one namespace per agent tool, deduped incremental
 * diff). This panel is a pure consumer: it never writes, never triggers
 * extraction, and never touches the main prompts/sessions store.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AgentHistoryPromptCacheItem } from '@/apps/pycore-manager/api';
import { PAGE_SIZE, toolLabel, toolPill } from './presentation';
import PcPager from './PcPager';
import PcAgentHistoryPromptRewrite, { type PromptRewriteMap } from './PcAgentHistoryPromptRewrite';

const PcAgentHistoryCachePanel: React.FC<{
  tk: (k: string) => string;
  /** Bumped by the page whenever a prompt-new event arrives. */
  bump: number;
  rewrites: PromptRewriteMap;
}> = ({ tk, bump, rewrites }) => {
  const [items, setItems] = useState<AgentHistoryPromptCacheItem[]>([]);
  const [namespaces, setNamespaces] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [namespace, setNamespace] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pycoreApi.getAgentHistoryPromptCache({
        tool: namespace || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!res.success || !res.data) {
        setError(res.error || tk('loadError'));
        return;
      }
      setItems(res.data.items || []);
      setNamespaces(res.data.namespaces || {});
      setTotal(res.data.total || 0);
      if (res.data.page && res.data.page !== page) setPage(res.data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : tk('loadError'));
    } finally {
      setLoading(false);
    }
  }, [namespace, page, tk]);

  useEffect(() => {
    void load();
  }, [load, bump]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Database className="w-3.5 h-3.5" />
          {tk('promptCacheHint')}
        </span>
        <select
          value={namespace}
          onChange={(e) => {
            setNamespace(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs"
        >
          <option value="">{tk('allTools')}</option>
          {Object.entries(namespaces).map(([name, count]) => (
            <option key={name} value={name}>
              {toolLabel(name)} ({count})
            </option>
          ))}
        </select>
        <span className="text-xs font-mono text-slate-400">
          {total} {tk('promptCount')}
        </span>
      </div>
      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {error ? (
          <div className="text-sm text-red-500 py-8 text-center">{error}</div>
        ) : loading && items.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">{tk('loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">{tk('promptCacheEmpty')}</div>
        ) : (
          items.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className={toolPill(p.tool)}>{toolLabel(p.tool)}</span>
                <span>{p.os_user}</span>
                <span className="font-mono">{p.time}</span>
              </div>
              <div className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                {p.text}
              </div>
              <PcAgentHistoryPromptRewrite rewrite={rewrites[p.id]} tk={tk} />
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && <PcPager page={page} totalPages={totalPages} onChange={setPage} tk={tk} />}
    </div>
  );
};

export default PcAgentHistoryCachePanel;
