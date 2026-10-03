/** AI Translation: two-pane translator with language pickers, swap, speak and a session history. */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, ClipboardPaste, Eraser, Languages, Square, Volume2 } from 'lucide-react';
import { callToolApi, ToolRunError, useToolRun } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, controlClass, CopyBtn, EmptyBlock, Notice, OpsPage, OpsStatusBar, Panel, Spinner } from './opsKit';
import { useRemote } from './opsHooks';
import { speechLocale } from './opsLogic';
import type { TranslateData, TranslationLanguage } from './opsTypes';

interface TranslationInput {
  text: string;
  sourceLang: string;
  targetLang: string;
}

interface TranslationResult {
  text: string;
  provider: string;
  model: string;
  cached: boolean;
  milliseconds: number;
}

interface RecentEntry extends TranslationInput {
  id: number;
  result: string;
}

const AUTO = 'auto';
const QUICK_TARGETS = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru'];
const RECENT_LIMIT = 6;
const PREVIEW_CHARS = 90;

const TranslationWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const previous = lastRun?.input as Partial<TranslationInput> | null | undefined;
  const [text, setText] = useState('');
  const [source, setSource] = useState(previous?.sourceLang ?? AUTO);
  const [target, setTarget] = useState(previous?.targetLang ?? (i18n.language.startsWith('zh') ? 'zh' : 'en'));
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recentId = useRef(0);
  const { result, error, running, run, reset } = useToolRun<TranslationResult>(tool.id, variant);
  const languages = useRemote(() => callToolApi<TranslationLanguage[]>('appQyV1.getTranslationLanguages'), []);

  const languageName = (code: string): string => t(`uiTools.languages.${code}`, {
    defaultValue: languages.data?.find((language) => language.code === code)?.native_name ?? code,
  });
  const options = useMemo(() => {
    const codes = languages.data?.map((language) => language.code) ?? QUICK_TARGETS;
    return codes;
  }, [languages.data]);
  const canSwap = source !== AUTO && !running;
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const translate = async (): Promise<void> => {
    const input: TranslationInput = { text: text.trim(), sourceLang: source, targetLang: target };
    if (!input.text || running) return;
    const started = performance.now();
    const outcome = await run(input, async () => {
      const data = await callToolApi<TranslateData>(tool.apiMethod, input);
      const translated = data?.translated_text ?? data?.translation ?? '';
      if (data?.success === false || !translated) throw new ToolRunError('remote_failed', { message: data?.error ?? t('toolsOps.translation.empty_result') });
      return { text: translated, provider: data.provider ?? '', model: data.model ?? '', cached: Boolean(data.cached), milliseconds: Math.round(performance.now() - started) };
    });
    if (outcome) {
      recentId.current += 1;
      setRecent((entries) => [{ ...input, id: recentId.current, result: outcome.text }, ...entries].slice(0, RECENT_LIMIT));
    }
  };

  const swap = (): void => {
    if (!canSwap) return;
    setSource(target);
    setTarget(source);
    if (result) setText(result.text);
    reset();
  };

  const toggleSpeech = (): void => {
    if (!speechSupported || !result) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(result.text);
    utterance.lang = speechLocale(target);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const paste = async (): Promise<void> => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard access denied: the user can paste into the field */
    }
  };

  const restore = (entry: RecentEntry): void => {
    setText(entry.text);
    setSource(entry.sourceLang);
    setTarget(entry.targetLang);
  };

  const select = (value: string, onChange: (code: string) => void, withAuto: boolean): React.ReactNode => (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass('fuchsia')}>
      {withAuto && <option value={AUTO}>{t('uiTools.languages.auto')}</option>}
      {options.map((code) => <option key={code} value={code}>{languageName(code)} ({code})</option>)}
    </select>
  );

  return (
    <OpsPage>
      <OpsStatusBar accent="fuchsia" mode="server">
        {running ? t('toolsOps.translation.translating')
          : result ? `${result.provider || t('toolsOps.translation.provider_unknown')}${result.model ? ` / ${result.model}` : ''}${result.cached ? ` · ${t('toolsOps.translation.cached')}` : ''} · ${result.milliseconds} ms`
            : t('toolsOps.translation.ready')}
      </OpsStatusBar>

      <Panel accent="fuchsia">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{select(source, setSource, true)}</div>
          <Btn variant="soft" accent="fuchsia" icon={ArrowLeftRight} onClick={swap} disabled={!canSwap} title={canSwap ? t('toolsOps.translation.swap') : t('toolsOps.translation.swap_needs_source')} className="shrink-0 !px-3" />
          <div className="min-w-0 flex-1">{select(target, setTarget, false)}</div>
        </div>
        <Chips className="mt-3" accent="fuchsia" value={target} onChange={setTarget} options={QUICK_TARGETS.map((code) => ({ value: code, label: languageName(code) }))} nowrap />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title={t('toolsOps.translation.source')}
          icon={Languages}
          accent="fuchsia"
          actions={(
            <>
              <Btn size="sm" icon={ClipboardPaste} onClick={() => void paste()}>{t('toolsOps.translation.paste')}</Btn>
              <Btn size="sm" icon={Eraser} onClick={() => { setText(''); reset(); }} disabled={!text && !result}>{t('uiTools.common.clear')}</Btn>
            </>
          )}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void translate(); }}
            placeholder={t('toolsOps.translation.source_placeholder')}
            rows={10}
            className={`${controlClass('fuchsia')} min-h-[14rem] resize-y`}
          />
          <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400">{t('toolsOps.translation.chars', { count: text.length })}</p>
        </Panel>

        <Panel
          title={t('toolsOps.translation.result')}
          icon={Languages}
          accent="fuchsia"
          actions={(
            <>
              {speechSupported && (
                <Btn size="sm" icon={speaking ? Square : Volume2} onClick={toggleSpeech} disabled={!result}>{speaking ? t('toolsOps.translation.stop') : t('toolsOps.translation.speak')}</Btn>
              )}
              <CopyBtn text={result?.text ?? ''} accent="fuchsia" />
            </>
          )}
        >
          <div className="min-h-[14rem] whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-900 dark:bg-slate-900/50 dark:text-slate-100">
            {running ? (
              <span className="flex items-center gap-2 text-slate-400"><Spinner />{t('toolsOps.translation.translating')}</span>
            ) : result ? result.text : (
              <span className="text-slate-400">{t('toolsOps.translation.output_placeholder')}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] tabular-nums text-slate-400">{t('toolsOps.translation.chars', { count: result?.text.length ?? 0 })}</p>
            {result && <Btn size="sm" variant="soft" accent="fuchsia" onClick={() => { setText(result.text); reset(); }}>{t('toolsOps.translation.use_as_source')}</Btn>}
          </div>
        </Panel>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {languages.error && <Notice tone="warn">{t('toolsOps.translation.languages_fallback')}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="primary" accent="fuchsia" icon={Languages} loading={running} onClick={() => void translate()} disabled={!text.trim()} className="px-8">
          {running ? t('toolsOps.translation.translating') : t('toolsOps.translation.translate')}
        </Btn>
        <span className="text-[11px] text-slate-400">{t('toolsOps.translation.shortcut')}</span>
      </div>

      <Panel title={t('toolsOps.translation.recent')} accent="fuchsia" bodyClassName="p-0">
        {recent.length === 0 ? (
          <EmptyBlock icon={Languages}>{t('toolsOps.translation.no_recent')}</EmptyBlock>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {recent.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => restore(entry)} className="block w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-300">{entry.sourceLang} → {entry.targetLang}</span>
                  <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{entry.text.slice(0, PREVIEW_CHARS)}</span>
                  <span className="block truncate text-xs text-slate-400">{entry.result.slice(0, PREVIEW_CHARS)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </OpsPage>
  );
};

export default TranslationWorkbench;
