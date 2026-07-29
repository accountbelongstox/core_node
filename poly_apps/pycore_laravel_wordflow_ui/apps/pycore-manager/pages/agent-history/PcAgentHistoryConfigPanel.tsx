import React, { useCallback, useEffect, useState } from 'react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';
import { callRpc, connectPycoreWs } from '../../../../core/api-libs/pycore/PycoreWs';
import { pycoreEventBus } from '../../../../core/api-libs/pycore/PycoreEventBus';
import PcAgentHistoryLogPanel from './PcAgentHistoryLogPanel';
import PcAgentHistoryToolCheckboxes from './PcAgentHistoryToolCheckboxes';
import PcLlmEnginesStrip from '../../components/PcLlmEnginesStrip';

const REFERENCE_LANGUAGE = 'CN';
const TARGET_LANGUAGE = 'EN';
const PIPELINE_SCOPES = new Set(['agent_history', 'agent_history_pipeline']);

/**
 * Article config panel — master ON/OFF toggle bound to config.enabled (backend
 * auto-processes history while on; no start call), plus language/word/LLM options.
 * Display-side phase/pending/last_error come from the operation store.
 */
const PcAgentHistoryConfigPanel: React.FC<{
  tk: (k: string) => string;
  onEnabledToolsChange?: (tools: string[]) => void;
}> = ({ tk, onEnabledToolsChange }) => {
  const [articleCfg, setArticleCfg] = useState<Record<string, unknown> | null>(null);
  const [opStatus, setOpStatus] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minRawWords, setMinRawWords] = useState(200);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await pycoreApi.getAgentHistoryArticleConfig();
      if (res.success && res.data) {
        setArticleCfg(res.data);
        setEnabled(!!res.data.enabled);
        setMinRawWords(Number(res.data.min_raw_words || 200));
        const tools = Array.isArray((res.data as any).enabled_tools)
          ? ((res.data as any).enabled_tools as unknown[]).map(String)
          : [];
        setEnabledTools(tools);
        onEnabledToolsChange?.(tools);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tk('loadError'));
    }
  }, [tk, onEnabledToolsChange]);

  const loadOpStatus = useCallback(async () => {
    try {
      const res = await callRpc('ui.operation.snapshot', { scope: 'agent_history' });
      if (res?.success && res.data?.operation) {
        setOpStatus(res.data.operation as Record<string, any>);
      }
    } catch {
      /* offline — keep last known operation status */
    }
  }, []);

  useEffect(() => {
    connectPycoreWs();
    void loadConfig();
    void loadOpStatus();
  }, [loadConfig, loadOpStatus]);

  // Refresh display-side operation status when the pipeline store changes.
  useEffect(() => {
    const off = pycoreEventBus.subscribe('operation.changed', (payload: any) => {
      const scope = String(payload?.operation_scope || '');
      if (scope && !PIPELINE_SCOPES.has(scope)) return;
      void loadOpStatus();
    });
    return () => { off(); };
  }, [loadOpStatus]);

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
        setArticleCfg(res.data);
        setMsg(tk('save'));
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

  const restartBackfill = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await pycoreApi.startAgentHistoryArticlePipeline();
      if (res.success) {
        setEnabled(true);
        setMsg(tk('pipelineQueued'));
        await loadConfig();
      } else {
        setMsg(res.error || tk('loadError'));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tk('loadError'));
    } finally {
      setBusy(false);
    }
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
              {tk('phase')}: {String(opStatus?.status || (articleCfg as any).phase || 'idle')}
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-xs text-slate-500">
            {tk('referenceLang')}
            <div className={inputCls}>Chinese · CN</div>
          </div>
          <div className="text-xs text-slate-500">
            {tk('targetLang')}
            <div className={inputCls}>English · EN</div>
          </div>
          <label className="text-xs text-slate-500">
            {tk('minRawWords')}
            <input type="number" min={120} max={2000} value={minRawWords}
              onChange={(e) => setMinRawWords(Number(e.target.value) || 200)}
              className={inputCls} />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => saveConfig()} disabled={busy}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/10">
              {tk('save')}
            </button>
            <button type="button" onClick={() => void restartBackfill()} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              title={tk('startPipeline')}>
              {tk('startPipeline')}
            </button>
          </div>
        </div>
        <PcAgentHistoryToolCheckboxes tk={tk} enabledTools={enabledTools} onToggle={handleToolToggle} />
        <PcLlmEnginesStrip tk={tk} />
        {articleCfg && (
          <div className="text-[11px] font-mono text-slate-500">
            {tk('publishedArticles')}: {Array.isArray((articleCfg as any).published) ? (articleCfg as any).published.length : 0}
          </div>
        )}
        {msg && <p className="text-xs text-indigo-600 dark:text-indigo-300">{msg}</p>}
      </section>

      {enabled && <PcAgentHistoryLogPanel tk={tk} />}
    </>
  );
};

export default PcAgentHistoryConfigPanel;
