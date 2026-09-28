/**
 * PcTranslatePage — pycore Google Translate status + a Google-vs-AI test box.
 *
 * Two capabilities, both direct on pycore :59000:
 *
 *  1. Status — is the FREE googletrans library importable, its version, the
 *     service URL, and the on-disk translation cache dir + entry count.
 *     Driven by `pycoreApi.getTranslateStatus()` over HTTP API.
 *
 *  2. Test box (the "share data with AI" requirement) — one text input + source
 *     and target language selectors feed the SAME input to BOTH paths:
 *       - "Translate (Google)" -> free-google translation HTTP,
 *         showing from_cache + pronunciation when present.
 *       - "Translate (AI)" -> unified AI translation HTTP,
 *         showing the model that handled it.
 *     The two results render side-by-side so the user compares Google vs AI.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. `L` maps each label to its `pc` locale key.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Languages, RefreshCw, WifiOff, Sparkles,
  Database, ArrowRightLeft, Bot,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  TranslateStatus, TranslateResponse, TranslateAiResponse,
} from '@/apps/pycore-manager/api';
import PcDictionaryPanel from '../components/PcDictionaryPanel';
import { PresenceBadge } from './vocabulary/vocabShared';

const L = {
  title: 'translatePage.title',
  subtitle: 'translatePage.subtitle',
  refresh: 'translatePage.refresh',
  status: 'translatePage.status',
  available: 'translatePage.available',
  unavailable: 'translatePage.unavailable',
  library: 'translatePage.library',
  version: 'translatePage.version',
  serviceUrl: 'translatePage.serviceUrl',
  cache: 'translatePage.cache',
  cacheEntries: 'translatePage.cacheEntries',
  recommended: 'translatePage.recommended',
  test: 'translatePage.test',
  testHint: 'translatePage.testHint',
  textPlaceholder: 'translatePage.textPlaceholder',
  from: 'translatePage.from',
  to: 'translatePage.to',
  swap: 'translatePage.swap',
  translateGoogle: 'translatePage.translateGoogle',
  translateAi: 'translatePage.translateAi',
  translating: 'translatePage.translating',
  google: 'translatePage.google',
  ai: 'translatePage.ai',
  fromCache: 'translatePage.fromCache',
  pronunciation: 'translatePage.pronunciation',
  model: 'translatePage.model',
  noResult: 'translatePage.noResult',
  offline: 'translatePage.offline',
  notSet: 'translatePage.notSet',
  translateFailed: 'translatePage.translateFailed',
} as const;

// A small common language set for the selectors. `auto` is source-only.
const SRC_LANGS: { code: string; labelKey: string }[] = [
  { code: 'auto', labelKey: 'translatePage.languages.auto' },
  { code: 'en', labelKey: 'translatePage.languages.en' },
  { code: 'zh-cn', labelKey: 'translatePage.languages.zhCn' },
  { code: 'ja', labelKey: 'translatePage.languages.ja' },
  { code: 'ko', labelKey: 'translatePage.languages.ko' },
  { code: 'es', labelKey: 'translatePage.languages.es' },
  { code: 'fr', labelKey: 'translatePage.languages.fr' },
  { code: 'de', labelKey: 'translatePage.languages.de' },
  { code: 'ru', labelKey: 'translatePage.languages.ru' },
  { code: 'it', labelKey: 'translatePage.languages.it' },
  { code: 'pt', labelKey: 'translatePage.languages.pt' },
];
// Target languages are the same set minus `auto`.
const DEST_LANGS = SRC_LANGS.filter((l) => l.code !== 'auto');

export default function PcTranslatePage() {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<TranslateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [text, setText] = useState('');
  const [src, setSrc] = useState('auto');
  const [dest, setDest] = useState('en');

  const [googleResult, setGoogleResult] = useState<TranslateResponse | null>(null);
  const [aiResult, setAiResult] = useState<TranslateAiResponse | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getTranslateStatus();
      setStatus(s);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const swap = useCallback(() => {
    // `auto` can't be a target; on swap fall back to English as the source.
    setSrc(dest);
    setDest(src === 'auto' ? 'en' : src);
  }, [src, dest]);

  const runGoogle = useCallback(async () => {
    const clean = text.trim();
    if (!clean || googleBusy) return;
    setGoogleBusy(true);
    setGoogleResult(null);
    try {
      const r = await pycoreApi.translate(clean, src, dest, true);
      setGoogleResult(r);
      setOffline(false);
    } catch (e: any) {
      setGoogleResult({ provider: 'google', error: e?.message || t(L.translateFailed) });
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
      const r = await pycoreApi.translateAi(clean, src, dest);
      setAiResult(r);
      setOffline(false);
    } catch (e: any) {
      setAiResult({ provider: 'ai', error: e?.message || t(L.translateFailed) });
    } finally {
      setAiBusy(false);
    }
  }, [text, src, dest, aiBusy, t]);

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-5">
      {/* Offline ECDICT + WordNet word dictionary (served alongside Google/AI). */}
      <PcDictionaryPanel />

      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Languages className="w-5 h-5 text-sky-500" /> {t(L.title)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{t(L.subtitle)}</p>
          </div>
          <button onClick={() => void loadStatus()} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t(L.refresh)}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {t(L.offline)}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(L.status)}</span>
            <PresenceBadge ok={!!status?.available} yesLabel={t(L.available)} noLabel={t(L.unavailable)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t(L.library)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.library || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t(L.version)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.version || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t(L.serviceUrl)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 truncate">{status?.service_url || t(L.notSet)}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><Database className="w-3 h-3" /> {t(L.cache)}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? t(L.cacheEntries, { count: status.cache_count }) : t(L.notSet)}
              </div>
            </div>
          </div>
          {status?.recommended_version && (
            <div className="mt-3 text-[10px] text-slate-400">
              {t(L.recommended)}: <span className="font-mono">{status.recommended_version}</span>
            </div>
          )}
        </div>
      </section>

      {/* test box */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <ArrowRightLeft className="w-4 h-4 text-sky-500" /> {t(L.test)}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t(L.testHint)}</p>

        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t(L.textPlaceholder)} rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 resize-y mb-3" />

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t(L.from)}</label>
            <select value={src} onChange={(e) => setSrc(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400">
              {SRC_LANGS.map((l) => <option key={l.code} value={l.code}>{t(l.labelKey)}</option>)}
            </select>
          </div>
          <button onClick={swap} title={t(L.swap)}
            className="px-2.5 py-2 mb-0.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 transition">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t(L.to)}</label>
            <select value={dest} onChange={(e) => setDest(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400">
              {DEST_LANGS.map((l) => <option key={l.code} value={l.code}>{t(l.labelKey)}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => void runGoogle()} disabled={!text.trim() || googleBusy}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {googleBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              {googleBusy ? t(L.translating) : t(L.translateGoogle)}
            </button>
            <button onClick={() => void runAi()} disabled={!text.trim() || aiBusy}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-600/20 transition flex items-center gap-1 disabled:opacity-50">
              {aiBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiBusy ? t(L.translating) : t(L.translateAi)}
            </button>
          </div>
        </div>

        {/* side-by-side results: Google vs AI on the SAME input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Google */}
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5" /> {t(L.google)}
              </span>
              {googleResult?.from_cache && (
                <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                  <Database className="w-3 h-3" /> {t(L.fromCache)}
                </span>
              )}
            </div>
            {googleResult ? (
              googleResult.error ? (
                <div className="text-sm text-rose-500">{googleResult.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                    {googleResult.translated_text}
                  </div>
                  {googleResult.pronunciation && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span className="font-semibold text-slate-400">{t(L.pronunciation)}: </span>
                      {googleResult.pronunciation}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono">
                    {googleResult.src} → {googleResult.dest}
                  </div>
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t(L.noResult)}</div>
            )}
          </div>

          {/* AI */}
          <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> {t(L.ai)}
              </span>
              {aiResult?.model && (
                <span className="text-[10px] font-semibold text-violet-400 font-mono">
                  {t(L.model)}: {aiResult.model}
                </span>
              )}
            </div>
            {aiResult ? (
              aiResult.error ? (
                <div className="text-sm text-rose-500">{aiResult.error}</div>
              ) : (
                <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                  {aiResult.translated_text}
                </div>
              )
            ) : (
              <div className="text-sm text-slate-400">{t(L.noResult)}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
