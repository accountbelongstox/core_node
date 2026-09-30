/**
 * PcTranslatePage — pycore Google Translate status + a Google-vs-AI test box.
 * One text input and language pair feed BOTH paths (free Google translate, unified
 * AI translate) and the results render side-by-side. Status card + offline banner
 * come from PcToolChrome.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Languages, RefreshCw, Sparkles, Database, ArrowRightLeft, Bot,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { TranslateStatus, TranslateResponse, TranslateAiResponse } from '@/apps/pycore-manager/api';
import PcDictionaryPanel from '../components/PcDictionaryPanel';
import { PcPresenceBadge } from '../components/ai/PcStatusPill';
import { PcToolStatusCard } from '../components/ai/tools/PcToolChrome';

const LANG_AUTO = 'auto';
const LANG_DEFAULT_TARGET = 'en';

// A small common language set for the selectors. `auto` is source-only.
const SRC_LANGS: { code: string; labelKey: string }[] = [
  { code: LANG_AUTO, labelKey: 'languages.auto' },
  { code: 'en', labelKey: 'languages.en' },
  { code: 'zh-cn', labelKey: 'languages.zhCn' },
  { code: 'ja', labelKey: 'languages.ja' },
  { code: 'ko', labelKey: 'languages.ko' },
  { code: 'es', labelKey: 'languages.es' },
  { code: 'fr', labelKey: 'languages.fr' },
  { code: 'de', labelKey: 'languages.de' },
  { code: 'ru', labelKey: 'languages.ru' },
  { code: 'it', labelKey: 'languages.it' },
  { code: 'pt', labelKey: 'languages.pt' },
];
const DEST_LANGS = SRC_LANGS.filter((language) => language.code !== LANG_AUTO);

const selectClass = 'px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400';

export default function PcTranslatePage() {
  const { t } = useTranslation('pc', { keyPrefix: 'translatePage' });
  const [status, setStatus] = useState<TranslateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [text, setText] = useState('');
  const [src, setSrc] = useState(LANG_AUTO);
  const [dest, setDest] = useState(LANG_DEFAULT_TARGET);

  const [googleResult, setGoogleResult] = useState<TranslateResponse | null>(null);
  const [aiResult, setAiResult] = useState<TranslateAiResponse | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await pycoreApi.getTranslateStatus());
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const swap = useCallback(() => {
    // `auto` cannot be a target; on swap fall back to English as the source.
    setSrc(dest);
    setDest(src === LANG_AUTO ? LANG_DEFAULT_TARGET : src);
  }, [src, dest]);

  const runGoogle = useCallback(async () => {
    const clean = text.trim();
    if (!clean || googleBusy) return;
    setGoogleBusy(true);
    setGoogleResult(null);
    try {
      setGoogleResult(await pycoreApi.translate(clean, src, dest, true));
      setOffline(false);
    } catch (error: any) {
      setGoogleResult({ provider: 'google', error: error?.message || t('translateFailed') });
    } finally {
      setGoogleBusy(false);
    }
  }, [text, src, dest, googleBusy, t]);

  const runAi = useCallback(async () => {
    const clean = text.trim();
    if (!clean || aiBusy) return;
    setAiBusy(true);
    setAiResult(null);
    try {
      setAiResult(await pycoreApi.translateAi(clean, src, dest));
      setOffline(false);
    } catch (error: any) {
      setAiResult({ provider: 'ai', error: error?.message || t('translateFailed') });
    } finally {
      setAiBusy(false);
    }
  }, [text, src, dest, aiBusy, t]);

  return (
    <div className="space-y-5">
      <PcDictionaryPanel />

      <PcToolStatusCard
        title={t('title')}
        subtitle={t('subtitle')}
        Icon={Languages}
        accent="text-sky-500"
        loading={loading}
        offline={offline}
        onRefresh={() => { void loadStatus(); }}
        statusLabel={t('status')}
        badges={<PcPresenceBadge ok={!!status?.available} yesLabel={t('available')} noLabel={t('unavailable')} />}
        fields={[
          { label: t('library'), value: status?.library || t('notSet') },
          { label: t('version'), value: status?.version || t('notSet') },
          { label: t('serviceUrl'), value: status?.service_url || t('notSet') },
          {
            label: t('cache'),
            Icon: Database,
            value: status ? t('cacheEntries', { count: status.cache_count }) : t('notSet'),
          },
        ]}
        footer={status?.recommended_version ? (
          <div className="mt-3 text-[10px] text-slate-400">
            {t('recommended')}: <span className="font-mono">{status.recommended_version}</span>
          </div>
        ) : null}
      />

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <ArrowRightLeft className="w-4 h-4 text-sky-500" /> {t('test')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t('testHint')}</p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('textPlaceholder')}
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 resize-y mb-3"
        />

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t('from')}</label>
            <select value={src} onChange={(event) => setSrc(event.target.value)} className={selectClass}>
              {SRC_LANGS.map((language) => <option key={language.code} value={language.code}>{t(language.labelKey)}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={swap}
            title={t('swap')}
            className="px-2.5 py-2 mb-0.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 transition">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t('to')}</label>
            <select value={dest} onChange={(event) => setDest(event.target.value)} className={selectClass}>
              {DEST_LANGS.map((language) => <option key={language.code} value={language.code}>{t(language.labelKey)}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => void runGoogle()}
              disabled={!text.trim() || googleBusy}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {googleBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              {googleBusy ? t('translating') : t('translateGoogle')}
            </button>
            <button
              type="button"
              onClick={() => void runAi()}
              disabled={!text.trim() || aiBusy}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {aiBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiBusy ? t('translating') : t('translateAi')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5" /> {t('google')}
              </span>
              {googleResult?.from_cache && (
                <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                  <Database className="w-3 h-3" /> {t('fromCache')}
                </span>
              )}
            </div>
            {googleResult ? (
              googleResult.error ? (
                <div className="text-sm text-rose-500">{googleResult.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{googleResult.translated_text}</div>
                  {googleResult.pronunciation && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span className="font-semibold text-slate-400">{t('pronunciation')}: </span>
                      {googleResult.pronunciation}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono">{googleResult.src} → {googleResult.dest}</div>
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t('noResult')}</div>
            )}
          </div>

          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> {t('ai')}
              </span>
              {aiResult?.model && (
                <span className="text-[10px] font-semibold text-violet-400 font-mono">{t('model')}: {aiResult.model}</span>
              )}
            </div>
            {aiResult ? (
              aiResult.error ? (
                <div className="text-sm text-rose-500">{aiResult.error}</div>
              ) : (
                <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{aiResult.translated_text}</div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t('noResult')}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
