/**
 * PcAiProviderPromptsEditor — editable prompt templates under the OpenRouter
 * provider label on the AI Capability page. One editor for the agent-history
 * article pipeline prompts (CN article / EN translation), the Linux
 * new-prompt EN derivation preset, and the new-prompt EN rewrite system
 * prompt. Persisted through the shared agent-history runtime store (persistAgentHistoryArticleConfig) so the backend keeps
 * exactly one config surface (the agent_history_article user-data section);
 * clearing a field restores the built-in default.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentHistoryRuntime, persistAgentHistoryArticleConfig } from '@/apps/pycore-manager/api';

const inputCls = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm';

// Editable template config keys and their label keys (agentHistory.*).
const PROMPT_FIELDS = [
  ['prompt_article_cn', 'promptArticleCn'],
  ['prompt_translate_en', 'promptTranslateEn'],
  ['prompt_derive_en', 'promptDeriveEn'],
  ['prompt_rewrite_en', 'promptRewriteEn'],
] as const;
type PromptKey = typeof PROMPT_FIELDS[number][0];
type PromptValues = Record<PromptKey, string>;

const mapFields = (value: (key: PromptKey) => string): PromptValues =>
  Object.fromEntries(PROMPT_FIELDS.map(([key]) => [key, value(key)])) as PromptValues;

const PcAiProviderPromptsEditor: React.FC = () => {
  const { t } = useTranslation('pc');
  const { articleConfig, articlePromptDefaults } = useAgentHistoryRuntime();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [values, setValues] = useState<PromptValues>(() => mapFields(() => ''));
  const dirty = useRef(false);

  useEffect(() => {
    if (!articleConfig || dirty.current) return;
    setValues(mapFields((key) => String(articleConfig[key] || articlePromptDefaults?.[key] || '')));
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
    void persist(mapFields((key) => (
      values[key].trim() === String(defaults[key] || '').trim() ? '' : values[key]
    )));
  };

  const reset = () => {
    dirty.current = false;
    setValues(mapFields((key) => String(articlePromptDefaults?.[key] || '')));
    void persist(mapFields(() => ''));
  };

  const edit = (key: PromptKey) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    dirty.current = true;
    const { value } = event.target;
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="mt-2 space-y-2 border-t border-slate-200/60 dark:border-white/5 pt-2">
      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        {t('agentHistory.promptsTitle')}
      </p>
      <p className="text-[10px] text-slate-500">{t('agentHistory.promptOverrideHint')}</p>
      {PROMPT_FIELDS.map(([key, label]) => (
        <label key={key} className="block text-[11px] text-slate-500">
          {t(`agentHistory.${label}`)}
          <textarea value={values[key]} onChange={edit(key)} rows={6}
            spellCheck={false} className={`${inputCls} font-mono text-[11px] leading-relaxed`} />
        </label>
      ))}
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
