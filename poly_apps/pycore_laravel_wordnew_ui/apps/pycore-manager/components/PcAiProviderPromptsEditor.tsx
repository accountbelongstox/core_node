/**
 * PcAiProviderPromptsEditor — editable prompt templates under the OpenRouter
 * provider label on the AI Capability page. One editor for the agent-history
 * article pipeline prompts (CN article / EN translation) AND the Linux
 * new-prompt EN derivation preset. Persisted through the shared agent-history
 * runtime store (persistAgentHistoryArticleConfig) so the backend keeps
 * exactly one config surface (the agent_history_article user-data section);
 * clearing a field restores the built-in default.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentHistoryRuntime, persistAgentHistoryArticleConfig } from '@/apps/pycore-manager/api';

const inputCls = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm';

const PcAiProviderPromptsEditor: React.FC = () => {
  const { t } = useTranslation('pc');
  const { articleConfig, articlePromptDefaults } = useAgentHistoryRuntime();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [promptArticleCn, setPromptArticleCn] = useState('');
  const [promptTranslateEn, setPromptTranslateEn] = useState('');
  const [promptDeriveEn, setPromptDeriveEn] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    if (!articleConfig || dirty.current) return;
    setPromptArticleCn(String(
      articleConfig.prompt_article_cn || articlePromptDefaults?.prompt_article_cn || '',
    ));
    setPromptTranslateEn(String(
      articleConfig.prompt_translate_en || articlePromptDefaults?.prompt_translate_en || '',
    ));
    setPromptDeriveEn(String(
      articleConfig.prompt_derive_en || articlePromptDefaults?.prompt_derive_en || '',
    ));
  }, [articleConfig, articlePromptDefaults]);

  const persist = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await persistAgentHistoryArticleConfig(patch);
      setMsg(res.success ? t('agentHistory.settingsSaved') : (res.error || t('agentHistory.loadError')));
      if (res.success) dirty.current = false;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('agentHistory.loadError'));
    } finally {
      setBusy(false);
    }
  };

  // Storing a copy identical to the built-in default is pointless: an empty
  // override falls back to the code default automatically.
  const save = () => {
    const defaults = articlePromptDefaults || {};
    const valueOrBlank = (value: string, key: string) =>
      value.trim() === String(defaults[key] || '').trim() ? '' : value;
    void persist({
      prompt_article_cn: valueOrBlank(promptArticleCn, 'prompt_article_cn'),
      prompt_translate_en: valueOrBlank(promptTranslateEn, 'prompt_translate_en'),
      prompt_derive_en: valueOrBlank(promptDeriveEn, 'prompt_derive_en'),
    });
  };

  const reset = () => {
    dirty.current = false;
    setPromptArticleCn(String(articlePromptDefaults?.prompt_article_cn || ''));
    setPromptTranslateEn(String(articlePromptDefaults?.prompt_translate_en || ''));
    setPromptDeriveEn(String(articlePromptDefaults?.prompt_derive_en || ''));
    void persist({ prompt_article_cn: '', prompt_translate_en: '', prompt_derive_en: '' });
  };

  const edit = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    dirty.current = true;
    setter(event.target.value);
  };

  return (
    <div className="mt-2 space-y-2 border-t border-slate-200/60 dark:border-white/5 pt-2">
      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        {t('agentHistory.promptsTitle')}
      </p>
      <p className="text-[10px] text-slate-500">{t('agentHistory.promptOverrideHint')}</p>
      <label className="block text-[11px] text-slate-500">
        {t('agentHistory.promptArticleCn')}
        <textarea value={promptArticleCn} onChange={edit(setPromptArticleCn)} rows={6}
          spellCheck={false} className={`${inputCls} font-mono text-[11px] leading-relaxed`} />
      </label>
      <label className="block text-[11px] text-slate-500">
        {t('agentHistory.promptTranslateEn')}
        <textarea value={promptTranslateEn} onChange={edit(setPromptTranslateEn)} rows={6}
          spellCheck={false} className={`${inputCls} font-mono text-[11px] leading-relaxed`} />
      </label>
      <label className="block text-[11px] text-slate-500">
        {t('agentHistory.promptDeriveEn')}
        <textarea value={promptDeriveEn} onChange={edit(setPromptDeriveEn)} rows={6}
          spellCheck={false} className={`${inputCls} font-mono text-[11px] leading-relaxed`} />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60">
          {t('agentHistory.saveSettings')}
        </button>
        <button type="button" onClick={reset} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-white/10">
          {t('agentHistory.promptReset')}
        </button>
      </div>
      {msg && <p className="text-[11px] text-indigo-600 dark:text-indigo-300">{msg}</p>}
    </div>
  );
};

export default PcAiProviderPromptsEditor;
