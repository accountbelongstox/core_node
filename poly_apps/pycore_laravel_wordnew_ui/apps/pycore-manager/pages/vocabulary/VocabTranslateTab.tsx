/**
 * Translate tab - source/target language, detect-and-translate, and TTS playback
 * of the result. Laravel data calls use the direct Laravel API boundary.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Languages, Volume2, Loader2, ArrowRightLeft, Copy, Check } from 'lucide-react';
import { laravelApi } from '@/apps/pycore-manager/api';
import type { VocabLanguageInfo } from '@/apps/pycore-manager/api';
import { VL, VocabBanner, VocabLoading, vp, toArray } from './vocabShared';

const L = {
  title: 'Translate',                                              // 翻译
  source: 'Source',                                               // 源语言
  target: 'Target',                                               // 目标语言
  auto: 'Auto-detect',                                            // 自动检测
  inputPh: 'Type text to translate…',                             // 输入要翻译的文本…
  translate: 'Translate',                                         // 翻译
  translating: 'Translating…',                                   // 翻译中…
  result: 'Result',                                               // 结果
  detected: 'Detected',                                           // 检测到
  speak: 'Speak',                                                 // 朗读
  speaking: 'Speaking…',                                          // 朗读中…
  empty: 'Translation result appears here.',                      // 翻译结果将显示在此。
  copy: 'Copy',                                                   // 复制
  copied: 'Copied',                                               // 已复制
};

export default function VocabTranslateTab() {
  const [languages, setLanguages] = useState<VocabLanguageInfo[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [offline, setOffline] = useState(false);

  const [source, setSource] = useState<string>('auto');
  const [target, setTarget] = useState<string>('zh');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string>('');
  const [detected, setDetected] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadLanguages = useCallback(async () => {
    setLoadingLangs(true);
    try {
      const r = await laravelApi.getVocabTranslationLanguages();
      setLanguages(toArray<VocabLanguageInfo>(vp(r)));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoadingLangs(false);
    }
  }, []);

  useEffect(() => { void loadLanguages(); }, [loadLanguages]);

  const swap = () => {
    if (source === 'auto') return;
    setSource(target);
    setTarget(source);
  };

  const runTranslate = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setResult('');
    setDetected('');
    setAudioUrl(null);
    try {
      const r = await laravelApi.translateVocab({
        text,
        source_language: source === 'auto' ? 'auto' : source,
        target_language: target,
      });
      // laravel returns {success, data: {translation, source_text, ...}}; the
      // FE wrapper aliases translation->translated_text. Handle both raw names.
      const p = vp<any>(r);
      const out = p.translated_text || p.translation;
      if (out) {
        setResult(out);
        setDetected(p.detected_language || p.source_language || '');
        setOffline(false);
      } else {
        setError((r && (r as any).error) || VL.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : VL.error);
    } finally {
      setBusy(false);
    }
  }, [input, source, target, busy]);

  const speak = useCallback(async () => {
    const text = result.trim();
    if (!text || ttsBusy) return;
    setTtsBusy(true);
    setTtsError(null);
    setAudioUrl(null);
    try {
      const r = await laravelApi.generateVocabTts({ text, language: target });
      const p = vp<any>(r);
      if (p && (p.audio_url || p.audio_base64)) {
        const url = p.audio_base64
          ? `data:${p.mime || 'audio/mpeg'};base64,${p.audio_base64}`
          : laravelApi.getVocabResourceUrl(String(p.audio_url || ''));
        if (!url) throw new Error('TTS audio is unavailable over HTTP API');
        setAudioUrl(url);
        setOffline(false);
        const audio = new Audio(url);
        audio.onended = () => setTtsBusy(false);
        audio.onerror = () => { setTtsBusy(false); setTtsError('playback failed'); };
        void audio.play().catch(() => { setTtsBusy(false); setTtsError('playback blocked'); });
      } else {
        setTtsError((p && p.error) || 'TTS produced no audio');
        setTtsBusy(false);
      }
    } catch (e) {
      setTtsBusy(false);
      setTtsError(e instanceof Error ? e.message : VL.error);
    }
  }, [result, target, ttsBusy]);

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  if (loadingLangs) return <VocabLoading />;
  if (offline) return <VocabBanner kind="offline" message={VL.offline} />;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <LangSelect label={L.source} value={source} onChange={setSource} languages={languages} includeAuto />
        <button
          onClick={swap}
          title="Swap"
          className="mb-1 p-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
        <LangSelect label={L.target} value={target} onChange={setTarget} languages={languages} />
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={L.inputPh}
        rows={4}
        className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
      />

      <button
        onClick={runTranslate}
        disabled={busy || !input.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-white font-medium disabled:opacity-50 hover:bg-sky-400"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
        {busy ? L.translating : L.translate}
      </button>

      {error && <VocabBanner kind="error" message={error} />}

      {(result || busy) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              {L.result}{detected ? ` · ${L.detected}: ${detected}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={copyResult} disabled={!result}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700/50 disabled:opacity-50">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? L.copied : L.copy}
              </button>
              <button onClick={speak} disabled={!result || ttsBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700/50 disabled:opacity-50">
                {ttsBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                {ttsBusy ? L.speaking : L.speak}
              </button>
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 min-h-[3rem] whitespace-pre-wrap">
            {result || (busy ? '…' : L.empty)}
          </div>
          {ttsError && <p className="text-xs text-rose-400">{ttsError}</p>}
        </div>
      )}
    </div>
  );
}

function LangSelect({
  label, value, onChange, languages, includeAuto,
}: {
  label: string; value: string; onChange: (v: string) => void;
  languages: VocabLanguageInfo[]; includeAuto?: boolean;
}) {
  return (
    <label className="flex-1 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400"
      >
        {includeAuto && <option value="auto">{L.auto}</option>}
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native ? `${l.name} (${l.native})` : l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
