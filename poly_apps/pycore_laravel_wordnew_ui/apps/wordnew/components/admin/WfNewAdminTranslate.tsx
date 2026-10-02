import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight, Languages, Loader2, Volume2, Play, Pause, History, Database, ShieldAlert,
} from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { wfNewAdminApi, adminErrorText } from '../../api';
import type { WfNewAdminLangOption, WfNewAdminTranslateResult } from '../../api';
import { puterTranslate } from '../../hooks/puterTranslate';
import { computeJobStatus, useComputeJobs } from '../../../../core/integrations/compute';
import { requestWordNewTts, wordNewCompute, wordNewComputeErrorText } from '../../services/compute/WordNewCompute';
import {
  AdminLabel, AdminPanel, AdminReveal, adminInputClass, useAdminAudio, useRequestGuard,
  type AdminPanelProps,
} from './adminKit';

/** Shown while GET /translation/languages loads (and kept on failure). */
const FALLBACK_LANGS: WfNewAdminLangOption[] = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
];

const HISTORY_MAX = 5;

interface WfNewHistoryEntry { text: string; translation: string }

const TTS_AUDIO_KEY = 'tts';

export const WfNewAdminTranslate: React.FC<AdminPanelProps> = ({
  activeTheme,
  trans,
  addToast,
}) => {
  const [langs, setLangs] = useState<WfNewAdminLangOption[]>(FALLBACK_LANGS);
  const [source, setSource] = useState('auto');
  const [target, setTarget] = useState('zh');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WfNewAdminTranslateResult | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsJobId, setTtsJobId] = useState<string | null>(null);
  const ttsJob = useComputeJobs(wordNewCompute, ttsJobId ? [ttsJobId] : [])[0];
  const ttsStatus = ttsJob ? computeJobStatus(ttsJob) : null;
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audio = useAdminAudio();
  const playing = audio.playingKey === TTS_AUDIO_KEY;
  const [history, setHistory] = useState<WfNewHistoryEntry[]>([]);

  const guard = useRequestGuard();

  // Load the real language catalog once; any failure keeps the fallback list.
  useEffect(() => {
    let active = true;
    wfNewAdminApi
      .getTranslationLanguages()
      .then((rows) => {
        if (active && rows.length > 0) setLangs(rows);
      })
      .catch(() => { /* fallback list stays */ });
    return () => { active = false; };
  }, []);

  const playUrl = useCallback((url: string) => audio.play(TTS_AUDIO_KEY, url), [audio.play]);

  const togglePlay = useCallback(() => {
    if (playing) audio.stop();
    else if (audioUrl) playUrl(audioUrl);
  }, [playing, audioUrl, playUrl, audio.stop]);

  const resetAudio = useCallback(() => {
    audio.stop();
    setAudioUrl(null);
  }, [audio.stop]);

  const pushHistory = useCallback((entryText: string, translation: string) => {
    setHistory((prev) => [{ text: entryText, translation }, ...prev.filter((h) => h.text !== entryText)].slice(0, HISTORY_MAX));
  }, []);

  const doTranslate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const r = await wfNewAdminApi.translate({
        text: trimmed, source_language: source, target_language: target,
      });
      if (!guard.isAlive()) return;
      setResult(r);
      resetAudio();
      pushHistory(trimmed, r.translation);
    } catch (e: any) {
      // Backend translate failed (401 needLogin / gateway down) - try the
      // keyless Puter.js AI tier client-side before surfacing the error.
      const fb = await puterTranslate(trimmed, source, target);
      if (!guard.isAlive()) return;
      if (fb) {
        setResult({
          translation: fb, provider: 'puter', model: 'gpt-5-nano',
          detected_language: source === 'auto' ? undefined : source,
          cached: false,
        });
        resetAudio();
        pushHistory(trimmed, fb);
        addToast(trans('admin.t.fallback'), 'info');
      } else {
        addToast(adminErrorText(e), 'warning');
      }
    } finally {
      if (guard.isAlive()) setBusy(false);
    }
  }, [text, busy, source, target, resetAudio, pushHistory, addToast, trans, guard]);

  const doTts = useCallback(async () => {
    if (!result?.translation || ttsBusy) return;
    setTtsBusy(true);
    try {
      // The backend TTS expects a language it knows — the target code as-is.
      const job = requestWordNewTts({ text: result.translation, language: target });
      setTtsJobId(job.id);
      const { url } = await job.result;
      if (!guard.isAlive()) return;
      setAudioUrl(url);
      playUrl(url);
    } catch (e: any) {
      addToast(wordNewComputeErrorText(trans, e) ?? adminErrorText(e), 'warning');
    } finally {
      if (guard.isAlive()) setTtsBusy(false);
    }
  }, [result, ttsBusy, target, playUrl, addToast, trans, guard]);

  const swap = useCallback(() => {
    if (source === 'auto') return;
    setSource(target);
    setTarget(source);
  }, [source, target]);

  const restoreEntry = useCallback((h: WfNewHistoryEntry) => {
    setText(h.text);
    setResult({ translation: h.translation });
    resetAudio();
  }, [resetAudio]);

  const hasSession = wfNewAdminApi.hasSession();
  const selectCls = adminInputClass(activeTheme, 'w-full');
  const metaChipCls = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border border-white/10 bg-white/5 text-zinc-400';

  return (
    <AdminReveal>
    <AdminPanel theme={activeTheme} className="space-y-5">
      {/* Info line + session warning */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-mono text-zinc-500 leading-relaxed max-w-xl">
          {trans('admin.t.desc')}
        </p>
        {!hasSession && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
            {trans('admin.needLogin')}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: language pair + input + submit */}
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <AdminLabel as="label" className="block">{trans('admin.t.source')}</AdminLabel>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
                <option value="auto">{trans('admin.t.auto')}</option>
                {langs.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={swap}
              disabled={source === 'auto'}
              className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40 shrink-0"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0 space-y-1.5">
              <AdminLabel as="label" className="block">{trans('admin.t.target')}</AdminLabel>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectCls}>
                {langs.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={trans('admin.t.ph')}
            className={adminInputClass(activeTheme, 'w-full resize-none')}
          />

          <button
            type="button"
            onClick={doTranslate}
            disabled={busy || text.trim().length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            {busy
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Languages className="w-4 h-4" />}
            {trans('admin.t.btn')}
          </button>
        </div>

        {/* Right: result + TTS + history */}
        <div className="space-y-4">
          {result ? (
            <div className="space-y-3">
              <AdminLabel>{trans('admin.t.result')}</AdminLabel>
              <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                <p className="text-sm text-zinc-100 whitespace-pre-line">{result.translation}</p>
              </div>
              {/* Meta chips: provider / model / detected language / cached */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {result.provider && (
                  <span className={metaChipCls}>{trans('admin.t.provider')}: {result.provider}</span>
                )}
                {result.model && <span className={metaChipCls}>{result.model}</span>}
                {result.detected_language && (
                  <span className={metaChipCls}>
                    <Languages className="w-3 h-3" /> {result.detected_language}
                  </span>
                )}
                {result.cached && (
                  <span className={metaChipCls}><Database className="w-3 h-3" /></span>
                )}
              </div>
              {/* TTS: generate speech for the translation, then play/pause */}
              <div className="flex items-center gap-2">
                <ChipButton onClick={doTts} disabled={ttsBusy} size="wide">
                  {ttsBusy
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Volume2 className="w-3.5 h-3.5" />}
                  {trans('admin.t.tts')}
                </ChipButton>
                {ttsBusy && ttsJobId && (
                  <ChipButton onClick={() => wordNewCompute.cancel(ttsJobId)} size="wide">
                    {trans('compute.cancel')}
                  </ChipButton>
                )}
                {ttsBusy && ttsStatus && (
                  <span className={metaChipCls}>
                    {trans(ttsStatus.key, ttsStatus.params as Record<string, string | number>)}
                    {ttsJob && ttsJob.progress > 0 && ttsJob.progress < 1 ? ` ${Math.round(ttsJob.progress * 100)}%` : ''}
                  </span>
                )}
                {audioUrl && (
                  <ChipButton variant={playing ? 'info' : 'default'} onClick={togglePlay} size="icon">
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </ChipButton>
                )}
              </div>
            </div>
          ) : (
            <StateMessage kind="empty" className="rounded-2xl border border-white/10 bg-white/[0.02]">{trans('admin.empty')}</StateMessage>
          )}

          {/* In-memory history (last 5), click to restore input + result */}
          {history.length > 0 && (
            <div className="space-y-1">
              {history.map((h) => (
                <button
                  key={h.text}
                  type="button"
                  onClick={() => restoreEntry(h)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 text-left transition min-w-0"
                >
                  <History className="w-3 h-3 text-zinc-600 shrink-0" />
                  <span className="text-[10px] font-mono text-zinc-400 truncate">{h.text}</span>
                  <span className="text-[10px] font-mono text-zinc-600 truncate">→ {h.translation}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPanel>
    </AdminReveal>
  );
};
