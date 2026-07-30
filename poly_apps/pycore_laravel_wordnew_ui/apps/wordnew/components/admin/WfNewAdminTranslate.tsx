/**
 * WfNewAdminTranslate — the "translate" panel of the SUPER-ADMIN console: a
 * translate / TTS test tool aimed at the LOCAL backend AI gateway.
 *
 * Data flows exclusively through wfNewAdminApi (page-origin pinned base — see
 * the WfNewAdminApi header). Both POST endpoints used here (translation
 * translate + tts generate) are sanctum-gated: without a wordnew session they
 * 401 and the standard needLogin toast applies; an amber notice chip warns
 * about that up-front (the tool still lets you try).
 *
 * Layout: one card, ~2 columns on md —
 *   left  : source/target selects (+ swap), input textarea, submit
 *   right : result text + provider/model/detected/cached meta, TTS chip with
 *           a shared single <audio> play/pause toggle, tiny in-memory history
 *           (last 5 pairs, click to restore — intentionally NOT persisted).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight, Languages, Loader2, Volume2, Play, Pause, History, Database, ShieldAlert,
} from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';
import { wfNewAdminApi } from '../../api';
import type { WfNewAdminLangOption, WfNewAdminTranslateResult } from '../../api';
import { puterTranslate } from '../../hooks/puterTranslate';

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

interface WfNewAdminTranslateProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewAdminTranslate: React.FC<WfNewAdminTranslateProps> = ({
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<WfNewHistoryEntry[]>([]);

  // Unmount guard for the async translate/tts callbacks + the single shared
  // <audio> element (never two overlapping clips).
  const alive = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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

  const playUrl = useCallback((url: string) => {
    if (audioRef.current) audioRef.current.pause();
    const el = new Audio(url);
    audioRef.current = el;
    el.onended = () => setPlaying(false);
    el.onerror = () => setPlaying(false);
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else if (audioUrl) {
      playUrl(audioUrl);
    }
  }, [playing, audioUrl, playUrl]);

  /** Drop the audio of the previous result (a new result invalidates it). */
  const resetAudio = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
    setAudioUrl(null);
  }, []);

  const doTranslate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const r = await wfNewAdminApi.translate({
        text: trimmed, source_language: source, target_language: target,
      });
      if (!alive.current) return;
      setResult(r);
      resetAudio();
      setHistory((prev) => [
        { text: trimmed, translation: r.translation },
        ...prev.filter((h) => h.text !== trimmed),
      ].slice(0, HISTORY_MAX));
    } catch (e: any) {
      // Backend translate failed (401 needLogin / gateway down) - try the
      // keyless Puter.js AI tier client-side before surfacing the error.
      const fb = await puterTranslate(trimmed, source, target);
      if (!alive.current) return;
      if (fb) {
        setResult({
          translation: fb, provider: 'puter', model: 'gpt-5-nano',
          detected_language: source === 'auto' ? undefined : source,
          cached: false,
        });
        resetAudio();
        setHistory((prev) => [
          { text: trimmed, translation: fb },
          ...prev.filter((h) => h.text !== trimmed),
        ].slice(0, HISTORY_MAX));
        addToast(trans('admin.t.fallback'), 'info');
      } else if (e?.status === 401) {
        addToast(trans('admin.needLogin'), 'warning');
      } else {
        addToast(String(e?.message || 'Request failed'), 'warning');
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [text, busy, source, target, resetAudio, addToast, trans]);

  const doTts = useCallback(async () => {
    if (!result?.translation || ttsBusy) return;
    setTtsBusy(true);
    try {
      // The backend TTS expects a language it knows — the target code as-is.
      const { audio_url } = await wfNewAdminApi.ttsGenerate({
        text: result.translation, language: target,
      });
      if (!alive.current) return;
      setAudioUrl(audio_url);
      if (audio_url) playUrl(audio_url);
    } catch (e: any) {
      if (e?.status === 401) addToast(trans('admin.needLogin'), 'warning');
      else addToast(String(e?.message || 'Request failed'), 'warning');
    } finally {
      if (alive.current) setTtsBusy(false);
    }
  }, [result, ttsBusy, target, playUrl, addToast, trans]);

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
  const selectCls = `w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`;
  const labelCls = 'text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300';
  const chipCls = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40';
  const metaChipCls = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border border-white/10 bg-white/5 text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-5`}
    >
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
              <label className={labelCls}>{trans('admin.t.source')}</label>
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
              <label className={labelCls}>{trans('admin.t.target')}</label>
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
            className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none resize-none ${activeTheme.inputClass}`}
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
              <p className={labelCls}>{trans('admin.t.result')}</p>
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
                <button type="button" onClick={doTts} disabled={ttsBusy} className={chipCls}>
                  {ttsBusy
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Volume2 className="w-3.5 h-3.5" />}
                  {trans('admin.t.tts')}
                </button>
                {audioUrl && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className={`p-1.5 rounded-lg border transition ${
                      playing
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400'
                    }`}
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-white/10 bg-white/[0.02]">
              <p className="text-[12px] font-mono text-zinc-500">{trans('admin.empty')}</p>
            </div>
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
    </motion.div>
  );
};
