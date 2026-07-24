import React, { useCallback, useEffect, useState } from 'react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';
import PcAgentHistoryLogPanel from './PcAgentHistoryLogPanel';
import PcLlmEnginesStrip from '../../components/PcLlmEnginesStrip';

const CONFIG_POLL_MS = 10_000;

const REFERENCE_LANGUAGE = 'CN';
const TARGET_LANGUAGE = 'EN';

/**
 * Article config panel — master ON/OFF toggle bound to config.enabled (backend
 * auto-processes history while on; no start call), plus language/word/LLM options.
 */
const PcAgentHistoryConfigPanel: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [articleCfg, setArticleCfg] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minRawWords, setMinRawWords] = useState(200);

  const loadConfig = useCallback(async () => {
    const res = await pycoreApi.getAgentHistoryArticleConfig();
    if (res.success && res.data) {
      setArticleCfg(res.data);
      setEnabled(!!res.data.enabled);
      setMinRawWords(Number(res.data.min_raw_words || 200));
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Keep the phase hint fresh while the pipeline is on.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => void loadConfig(), CONFIG_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, loadConfig]);

  const saveConfig = async (enabledOverride?: boolean) => {
    setBusy(true);
    setMsg(null);
    const on = enabledOverride ?? enabled;
    const res = await pycoreApi.saveAgentHistoryArticleConfig({
      extract_as_article: on,
      enabled: on,
      reference_lang: REFERENCE_LANGUAGE,
      target_lang: TARGET_LANGUAGE,
      min_raw_words: minRawWords,
      live_listen: true,
    });
    if (res.success && res.data) {
      setArticleCfg(res.data);
      setMsg(tk('save'));
    } else {
      setMsg(res.error || tk('loadError'));
    }
    setBusy(false);
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
              {tk('phase')}: {String((articleCfg as any).phase || 'idle')}
              {(articleCfg as any).last_error ? (
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
          </div>
        </div>
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
