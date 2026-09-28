/**
 * AI-rewritten English version of one agent prompt (prompt_rewrite_service):
 * rendered under a prompt card wherever prompts are listed. The feed is the
 * read-only prompt_rewrite_cache; live items arrive on the
 * agent_history.prompt.rewritten topic.
 */
import React, { useEffect, useState } from 'react';
import { AudioLines, Check, Copy, Languages } from 'lucide-react';
import { pycoreApi, pycoreEventBus, PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import type { AgentHistoryPromptDerivedItem } from '@/apps/pycore-manager/api';

const REWRITE_FEED_PAGE_SIZE = 200;

export type PromptRewriteMap = Record<string, AgentHistoryPromptDerivedItem>;

/** Newest rewrites keyed by prompt id; merges live pushes. */
export function usePromptRewrites(): PromptRewriteMap {
  const [rewrites, setRewrites] = useState<PromptRewriteMap>({});

  useEffect(() => {
    let cancelled = false;
    void pycoreApi.getAgentHistoryPromptRewritten({ page: 1, pageSize: REWRITE_FEED_PAGE_SIZE })
      .then((res) => {
        if (cancelled || !res?.success || !res.data) return;
        const loaded: PromptRewriteMap = {};
        for (const item of res.data.items || []) loaded[item.id] = item;
        setRewrites((current) => ({ ...loaded, ...current }));
      })
      .catch(() => {});
    const off = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.agentHistoryPromptRewritten, (payload: unknown) => {
      const item = (payload as { item?: AgentHistoryPromptDerivedItem } | null)?.item;
      if (item?.id) setRewrites((current) => ({ ...current, [item.id]: item }));
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return rewrites;
}

const PcAgentHistoryPromptRewrite: React.FC<{
  rewrite?: AgentHistoryPromptDerivedItem;
  tk: (key: string) => string;
}> = ({ rewrite, tk }) => {
  const [copied, setCopied] = useState(false);
  if (!rewrite?.derived_text) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rewrite.derived_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
        <Languages size={12} />
        <span className="font-semibold">{tk('promptRewritten')}</span>
        {rewrite.model && <span className="font-mono text-slate-400">{rewrite.model}</span>}
        {rewrite.audio_task_id && (
          <span className="inline-flex items-center gap-1 font-mono text-slate-400" title={tk('promptRewriteAudioTask')}>
            <AudioLines size={11} />{rewrite.audio_task_id}
          </span>
        )}
        <button type="button" onClick={copy} title={tk('copy')}
          className="ml-auto p-1 rounded text-slate-400 hover:text-emerald-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-48 overflow-auto">
        {rewrite.derived_text}
      </p>
    </div>
  );
};

export default PcAgentHistoryPromptRewrite;
