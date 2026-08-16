import React, { useEffect, useRef, useState } from 'react';
import {
  pycoreApi,
  setAgentHistoryArticleConfig,
  useAgentHistoryRuntime,
} from '@/apps/pycore-manager/api';
import PcAgentHistoryLogPanel from './PcAgentHistoryLogPanel';
import PcAgentHistoryAiPanel from './PcAgentHistoryAiPanel';
import PcAgentHistoryToolCheckboxes from './PcAgentHistoryToolCheckboxes';
import { AGENT_HISTORY_TOOLS } from './presentation';
import type { AgentHistoryTaskPeriod } from '../../persistence/AgentHistoryUiStateStore';

const REFERENCE_LANGUAGE = 'CN';
const TARGET_LANGUAGE = 'EN';
const AGENT_HISTORY_TOOL_SET = new Set<string>(AGENT_HISTORY_TOOLS);

/**
 * Article config panel — master ON/OFF toggle bound to config.enabled (backend
 * auto-processes history while on; no start call), plus language/word/LLM options.
 * Display-side phase/pending/last_error come from the operation store.
 */
const PcAgentHistoryConfigPanel: React.FC<{
  tk: (k: string) => string;
  selectedTool: string;
  restoredEnabledTools: string[];
  storeRevision?: string;
  onEnabledToolsChange?: (tools: string[], initialHydration?: boolean) => void;
  onSelectedToolChange: (tool: string) => void;
  taskPeriod: AgentHistoryTaskPeriod;
  onTaskPeriodChange: (period: AgentHistoryTaskPeriod) => void;
}> = ({
  tk,
  selectedTool,
  restoredEnabledTools,
  storeRevision,
  onEnabledToolsChange,
  onSelectedToolChange,
  taskPeriod,
  onTaskPeriodChange,
}) => {
  const {
    articleConfig: articleCfg,
    articleSummary,
    operationSnapshot,
    configError,
    authoritative,
  } = useAgentHistoryRuntime();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minRawWords, setMinRawWords] = useState(200);
  const [enabledTools, setEnabledTools] = useState<string[]>(restoredEnabledTools);
  const toolsHydrated = useRef(false);

  useEffect(() => {
    if (!articleCfg) return;
    setEnabled(!!articleCfg.enabled);
    setMinRawWords(Number(articleCfg.min_raw_words || 200));
    if (!authoritative) return;
    const tools = Array.isArray(articleCfg.enabled_tools)
      ? (articleCfg.enabled_tools as unknown[])
        .map(String)
        .filter((tool) => AGENT_HISTORY_TOOL_SET.has(tool))
      : [];
    setEnabledTools(tools);
    const initialHydration = !toolsHydrated.current;
    toolsHydrated.current = true;
    onEnabledToolsChange?.(tools, initialHydration);
  }, [articleCfg, authoritative, onEnabledToolsChange]);

  useEffect(() => {
    if (!authoritative) setEnabledTools(restoredEnabledTools);
  }, [authoritative, restoredEnabledTools]);

  const opStatus = operationSnapshot?.operation as Record<string, any> | undefined;
  const currentItem = operationSnapshot?.current_item as Record<string, any> | undefined;
  const totals = opStatus?.totals as Record<string, any> | undefined;
  const totalItems = Math.max(0, Number(totals?.total || 0));
  const completedItems = Number(totals?.succeeded || 0)
    + Number(totals?.skipped || 0)
    + Number(totals?.failed || 0)
    + Number(totals?.cancelled || 0);
  const itemProgress = Math.max(0, Math.min(1, Number(currentItem?.progress || 0)));
  const progressValue = totalItems > 0
    ? Math.max(0, Math.min(1, (completedItems + itemProgress) / totalItems))
    : itemProgress;
  const processing = enabled
    && Boolean(opStatus)
    && !['completed', 'failed', 'cancelled'].includes(String(opStatus?.status || ''));
  const operationStatus = String(opStatus?.status || '');
  const phaseText = !enabled
    ? tk('phasePaused')
    : operationStatus === 'failed'
      ? tk('phaseFailed')
      : processing
        ? tk('phaseRunning')
        : tk('phaseWaiting');

  const saveConfig = async (enabledOverride?: boolean, toolsOverride?: string[]) => {
    setBusy(true);
    setMsg(null);
    const on = enabledOverride ?? enabled;
    const tools = toolsOverride ?? enabledTools;
    try {
      const res = await pycoreApi.saveAgentHistoryArticleConfig({
        extract_as_article: on,
        enabled: on,
        reference_lang: REFERENCE_LANGUAGE,
        target_lang: TARGET_LANGUAGE,
        min_raw_words: minRawWords,
        live_listen: true,
        enabled_tools: tools,
      });
      if (res.success && res.data) {
        setAgentHistoryArticleConfig(res.data);
        setMsg(tk('settingsSaved'));
      } else {
        setMsg(res.error || tk('loadError'));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tk('loadError'));
    } finally {
      setBusy(false);
    }
  };

  const handleToolToggle = (tool: string, checked: boolean) => {
    const tools = checked
      ? [...enabledTools, tool]
      : enabledTools.filter((t) => t !== tool);
    setEnabledTools(tools);
    onEnabledToolsChange?.(tools);
    void saveConfig(undefined, tools);
  };

  const inputCls = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm';

  return (
    <>
      <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tk('articleTitle')}</h2>
          <p className="text-xs text-slate-500 mt-1">{tk('articleSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => {
              const on = !enabled;
              setEnabled(on);
              void saveConfig(on);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/15'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-sm text-slate-700 dark:text-slate-200">{tk('autoProcess')}</span>
          {articleCfg && (
            <span className="text-[11px] font-mono text-slate-500">
              {tk('phase')}: {phaseText}
              {opStatus?.error ? (
                <span className="text-rose-500 ml-2">
                  {tk('lastError')}: {typeof opStatus.error === 'string' ? opStatus.error : JSON.stringify(opStatus.error)}
                </span>
              ) : (articleCfg as any).last_error ? (
                <span className="text-rose-500 ml-2">{tk('lastError')}: {String((articleCfg as any).last_error)}</span>
              ) : null}
            </span>
          )}
        </div>
        {processing && (
          <div className="space-y-1.5" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-indigo-600 dark:text-indigo-300">
              <span>
                {tk('processing')}: {String(currentItem?.stage || opStatus?.stage || 'running')}
              </span>
              <span>
                {Math.round(progressValue * 100)}%
                {totalItems > 0 ? ` · ${completedItems}/${totalItems}` : ''}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                style={{ width: `${Math.round(progressValue * 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-xs text-slate-500">
            {tk('referenceLang')}
            <div className={inputCls}>{tk('referenceLanguageValue')}</div>
          </div>
          <div className="text-xs text-slate-500">
            {tk('targetLang')}
            <div className={inputCls}>{tk('targetLanguageValue')}</div>
          </div>
          <label className="text-xs text-slate-500">
            {tk('minRawWords')}
            <div className="relative">
              <input type="number" min={120} max={2000} value={minRawWords}
                onChange={(e) => setMinRawWords(Number(e.target.value) || 200)}
                className={`${inputCls} pr-14`} />
              <span className="pointer-events-none absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-[11px] text-slate-400">
                {tk('words')}
              </span>
            </div>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => saveConfig()} disabled={busy}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/10">
              {tk('saveSettings')}
            </button>
          </div>
        </div>
        <PcAgentHistoryToolCheckboxes
          tk={tk}
          enabledTools={enabledTools}
          selectedTool={selectedTool}
          refreshRevision={`${storeRevision || ''}|${String(opStatus?.revision || '')}`}
          onToggle={handleToolToggle}
          onSelect={onSelectedToolChange}
        />
        <PcAgentHistoryAiPanel
          tk={tk}
          taskPeriod={taskPeriod}
          onTaskPeriodChange={onTaskPeriodChange}
        />
        {articleCfg && (
          <div className="text-[11px] font-mono text-slate-500">
            {tk('publishedArticles')}: {Number(articleSummary?.uploaded || 0)} · {tk('recordsTitle')}: {Number(articleSummary?.total || 0)} · {tk('pendingUpload')}: {Number(articleSummary?.pending_upload || 0)} · {tk('rebuildPending')}: {Number(articleSummary?.rebuild_pending || 0)}
          </div>
        )}
        {msg && <p className="text-xs text-indigo-600 dark:text-indigo-300">{msg}</p>}
        {!msg && configError && (
          <p className="text-xs text-rose-500">{configError}</p>
        )}
      </section>

      {enabled && <PcAgentHistoryLogPanel tk={tk} />}
    </>
  );
};

export default PcAgentHistoryConfigPanel;
