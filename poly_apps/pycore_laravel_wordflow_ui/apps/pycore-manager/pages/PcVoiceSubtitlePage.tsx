/**
 * PcVoiceSubtitlePage — merged Voice/TTS Queue + Subtitle Mode (tabbed).
 *
 * One page over the pycore voice-subtitle pipeline (`/pyapi/voice-subtitle/*`),
 * superseding the separate PcVoicePlayerPage / PcSubtitlePage:
 *
 *   - Shared strip: AI Auto-Subtitle switches — the SCREENSHOT monitor (capture
 *     the screen every N seconds → AI describes the image → translate → TTS →
 *     queue) and the CLIPBOARD monitor (copied sentences → AI rewrite → queue) —
 *     plus the PLAYBACK switch (/voice-subtitle/toggle): when on, the backend
 *     desktop player auto-plays through the queue and broadcasts each item as a
 *     `voice_subtitle_update` tick, which drives the live stage here.
 *   - Queue tab: enqueue TTS (with AI Compose via a probed provider), inspect /
 *     play / delete items.
 *   - Subtitle tab: large-type stage of the active item (AI Explain), clickable
 *     list synced to the backend player via /voice-subtitle/set-index.
 *
 * Live updates ride the `voice_subtitle_queue_update` WS snapshot. Offline the
 * page degrades to the cached snapshot with an inline banner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Layers, Layers2, Trash2, RefreshCw, PlusCircle, Volume2, AlertTriangle, Loader2,
  Sparkles, Captions, ChevronRight, Play, Pause, Camera, ClipboardList,
  Image as ImageIcon, FileText, ListChecks, Video, AppWindow, Languages,
} from 'lucide-react';
import {
  pycoreApi, mapQueueSnapshot, subscribe, connectPycoreWs, loadQueueCache, saveQueueCache,
} from '../../../core/api-libs/pycore';
import type { QueueItem } from '../../../core/api-libs/pycore';
import { usePcCapability } from '../PcCapabilityContext';
import { PcPipelineStatusPanels } from '../components/PcPipelineStatusPanels';

const CATEGORY_CLS: Record<string, string> = {
  Voice: 'bg-blue-500/15 text-blue-500',
  Window: 'bg-purple-500/15 text-purple-500',
  Task: 'bg-amber-500/15 text-amber-500',
  Video: 'bg-rose-500/15 text-rose-500',
  Image: 'bg-emerald-500/15 text-emerald-500',
  File: 'bg-cyan-500/15 text-cyan-500',
};

const TIER_CLS: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-500',
  balance: 'bg-amber-500/15 text-amber-500',
  paid: 'bg-rose-500/15 text-rose-500',
};

const CATEGORY_ICON: Record<string, React.FC<{ className?: string }>> = {
  Voice: Volume2,
  Image: ImageIcon,
  File: FileText,
  Task: ListChecks,
  Video: Video,
  Window: AppWindow,
};

function statusLabel(s: QueueItem['status']): { text: string; cls: string } {
  switch (s) {
    case 'completed': return { text: 'READY', cls: 'text-emerald-500' };
    case 'processing': return { text: 'RUNNING', cls: 'text-sky-500' };
    case 'failed': return { text: 'FAILED', cls: 'text-rose-500' };
    default: return { text: 'QUEUED', cls: 'text-slate-400' };
  }
}

/**
 * One chat turn through the unified AI gateway (provider auto-selected by
 * tier/quota/cooldown server-side; the reply says which AI handled it).
 */
async function aiChatOnce(system: string, user: string, source: string): Promise<{ text?: string; meta?: string; error?: string }> {
  const r = await pycoreApi.aiAuto([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], source);
  if (r?.success && r.text) return { text: r.text.trim(), meta: `${r.provider} / ${r.model}` };
  return { error: r?.error || 'AI request failed' };
}

type Tab = 'queue' | 'stage';

const PcVoiceSubtitlePage: React.FC = () => {
  // Persist the active tab + recognition language so the page keeps its state
  // across navigation (switch to another page and back).
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('pc_vs_tab') as Tab) || 'queue');
  const [lang, setLang] = useState<string>(() => localStorage.getItem('pc_vs_lang') || 'en');
  useEffect(() => { localStorage.setItem('pc_vs_tab', tab); }, [tab]);

  // ----- shared queue state ------------------------------------------------ #
  const [items, setItems] = useState<QueueItem[]>(() => loadQueueCache() ?? []);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- monitors + playback ------------------------------------------------ #
  const [playbackOn, setPlaybackOn] = useState(false);
  const [shotOn, setShotOn] = useState(false);
  const [shotInterval, setShotInterval] = useState(60);
  const [clipOn, setClipOn] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [playingText, setPlayingText] = useState<string | null>(null);

  const { retry: retryCapabilityStatus } = usePcCapability();

  // ----- queue tab ----------------------------------------------------------- #
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [browserPlaying, setBrowserPlaying] = useState<string | null>(null);

  // ----- subtitle tab --------------------------------------------------------- #
  const [aiExplainBusy, setAiExplainBusy] = useState(false);
  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<string | null>(null);

  const applySnapshot = useCallback((r: ReturnType<typeof mapQueueSnapshot>) => {
    setItems(r.items ?? []);
    saveQueueCache(r.items ?? []);
    if (typeof r.currentIndex === 'number') setCurrentIndex(r.currentIndex);
    if (typeof r.enabled === 'boolean') setPlaybackOn(r.enabled);
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pycoreApi.getQueue();
      applySnapshot(r);
      setUnreachable(false);
      setError(r?.error ?? null);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  const fetchMonitors = useCallback(async () => {
    try {
      const [shot, clip] = await Promise.all([
        pycoreApi.getScreenshotMonitorStatus(),
        pycoreApi.getClipboardMonitorStatus(),
      ]);
      setShotOn(shot?.enabled === true);
      if (typeof shot?.interval === 'number' && shot.interval > 0) setShotInterval(shot.interval);
      setClipOn(clip?.enabled === true);
    } catch { /* offline: switches stay at their last known state */ }
  }, []);

  useEffect(() => { fetchQueue(); fetchMonitors(); }, [fetchQueue, fetchMonitors]);

  // Keep monitor switches in sync with the backend.
  useEffect(() => {
    const id = window.setInterval(() => { fetchMonitors(); }, 20000);
    return () => window.clearInterval(id);
  }, [fetchMonitors]);

  // Live updates: full snapshot on every queue mutation + per-item playback tick.
  useEffect(() => {
    connectPycoreWs();
    const offQueue = subscribe('voice_subtitle_queue_update', (data: any) => {
      applySnapshot(mapQueueSnapshot(data));
      setUnreachable(false);
    });
    const offPlay = subscribe('voice_subtitle_update', (data: any) => {
      if (typeof data?.text === 'string') setPlayingText(data.text);
    });
    return () => { offQueue(); offPlay(); };
  }, [applySnapshot]);

  // ----- switches ------------------------------------------------------------ #
  const togglePlayback = useCallback(async () => {
    setSwitching('playback');
    try {
      const r = await pycoreApi.togglePlayback();
      setPlaybackOn(r?.enabled === true);
      if (r?.enabled !== true) setPlayingText(null);
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setSwitching(null);
    }
  }, []);

  const toggleScreenshot = useCallback(async () => {
    setSwitching('screenshot');
    try {
      if (shotOn) await pycoreApi.stopScreenshotMonitor();
      else await pycoreApi.startScreenshotMonitor(Math.max(5, shotInterval), lang);
      await fetchMonitors();
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setSwitching(null);
    }
  }, [shotOn, shotInterval, lang, fetchMonitors]);

  // Recognition/output language — the single parameter for OCR → translate →
  // TTS. Persisted; pushed to a running monitor so it applies live.
  const handleLangChange = useCallback(async (next: string) => {
    setLang(next);
    localStorage.setItem('pc_vs_lang', next);
    if (shotOn) {
      try { await pycoreApi.setScreenshotLanguage(next); } catch { /* best-effort */ }
    }
  }, [shotOn]);

  const toggleClipboard = useCallback(async () => {
    setSwitching('clipboard');
    try {
      if (clipOn) await pycoreApi.stopClipboardMonitor();
      else await pycoreApi.startClipboardMonitor();
      await fetchMonitors();
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setSwitching(null);
    }
  }, [clipOn, fetchMonitors]);

  // ----- queue actions --------------------------------------------------------- #
  const handleAiCompose = useCallback(async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setNotice(null);
    const seed = text.trim();
    try {
      const r = await aiChatOnce(
        'You write one short, natural spoken-English sentence for text-to-speech practice. Reply with the sentence only — no quotes, no explanations.',
        seed ? `Polish this into one natural spoken sentence: ${seed}` : 'Write one useful everyday English sentence.',
        'compose',
      );
      if (r.text) {
        setText(r.text);
        setNotice(`AI composed via ${r.meta} — review, then Add TTS.`);
      } else {
        setNotice(r.error || 'AI compose failed');
      }
    } catch (e: any) {
      setNotice(e?.message || 'AI compose failed');
    } finally {
      setAiBusy(false);
    }
  }, [text, aiBusy]);

  const handleAdd = useCallback(async () => {
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const r = await pycoreApi.tts(value, ['en'], 'normal');
      if (r?.success === false) {
        setNotice(r?.message || 'Failed to queue TTS');
      } else {
        setNotice(r?.queued ? 'Queued for synthesis' : 'Sent to pycore');
        setText('');
        fetchQueue();
      }
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setNotice(e?.message || 'pycore unreachable');
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, fetchQueue]);

  const handleClear = useCallback(async () => {
    try {
      await pycoreApi.clearQueue();
      setItems([]);
      saveQueueCache([]);
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    }
  }, []);

  const handleDelete = useCallback(async (item: QueueItem) => {
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    saveQueueCache(next);
    try {
      await pycoreApi.removeQueueItems([item.index]);
      setUnreachable(false);
      fetchQueue();
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    }
  }, [items, fetchQueue]);

  // In-browser playback of a single item's generated audio (the backend player
  // is separate — it plays on the pycore host when the Playback switch is on).
  const handleBrowserPlay = useCallback((item: QueueItem) => {
    if (!item.audioUrl) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (browserPlaying === item.id) { setBrowserPlaying(null); return; }
    const audio = new Audio(item.audioUrl);
    audioRef.current = audio;
    setBrowserPlaying(item.id);
    audio.onended = () => { setBrowserPlaying(null); audioRef.current = null; };
    audio.onerror = () => { setBrowserPlaying(null); audioRef.current = null; };
    audio.play().catch(() => setBrowserPlaying(null));
    pycoreApi.incrementPlayCount(item.index).catch(() => { /* count is best-effort */ });
  }, [browserPlaying]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ----- subtitle actions -------------------------------------------------------- #
  const selectItem = useCallback((index: number) => {
    setCurrentIndex(index);
    setAiExplain(null);
    setAiMeta(null);
    pycoreApi.setQueueIndex(index).catch(() => { /* offline: stage-only switch */ });
  }, []);

  const current =
    (currentIndex != null ? items.find((q) => q.index === currentIndex) : undefined) || items[0];
  // The live playback tick (backend player) takes precedence on the stage.
  const stageText = playbackOn && playingText ? playingText : current?.text;

  const handleAiExplain = useCallback(async () => {
    const sentence = stageText;
    if (!sentence || aiExplainBusy) return;
    setAiExplainBusy(true);
    setAiExplain(null);
    setAiMeta(null);
    try {
      const r = await aiChatOnce(
        'You are a concise language tutor. Explain the given sentence for a learner: meaning, one or two key words/phrases, and a short usage note. Max 80 words, plain text.',
        sentence,
        'explain',
      );
      if (r.text) { setAiExplain(r.text); setAiMeta(r.meta ?? null); }
      else setAiExplain(r.error || 'AI explain failed');
    } catch (e: any) {
      setAiExplain(e?.message || 'AI explain failed');
    } finally {
      setAiExplainBusy(false);
    }
  }, [stageText, aiExplainBusy]);

  const total = items.length;
  const todayCount = items.filter(
    (q) => typeof q.created === 'string' && q.created.startsWith(new Date().toISOString().slice(0, 10)),
  ).length;

  const switchCls = (on: boolean) =>
    `relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-white/15'}`;
  const knobCls = (on: boolean) =>
    `absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* header + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Volume2 className="w-5 h-5 text-indigo-500" /> Voice &amp; Subtitle
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            pycore voice-subtitle pipeline — TTS queue, live subtitle stage, AI auto-subtitle monitors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl pc-glass overflow-hidden">
            {([['queue', 'Queue', Layers], ['stage', 'Subtitle', Captions]] as [Tab, string, React.FC<{ className?: string }>][]).map(
              ([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                    tab === key
                      ? 'bg-indigo-500/15 text-indigo-500'
                      : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ),
            )}
          </div>
          <button
            onClick={() => { fetchQueue(); fetchMonitors(); void retryCapabilityStatus(); }}
            disabled={loading}
            className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
            title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            pycore unreachable — showing the last cached snapshot. The backend (:59000) may be offline.
            {error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      {/* AI auto-subtitle + playback strip */}
      <section className="pc-glass p-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <button
          onClick={togglePlayback}
          disabled={switching === 'playback'}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 ${
            playbackOn
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20'
          }`}
          title="Backend player: auto-plays through the queue on the pycore host">
          {switching === 'playback'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : playbackOn ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playbackOn ? 'Playing' : 'Play'}
        </button>

        <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer select-none" title="Capture the screen every N seconds; AI describes it and the description is enqueued as a subtitle (translate → TTS).">
            <button onClick={toggleScreenshot} disabled={switching === 'screenshot'} className={switchCls(shotOn)}>
              <span className={knobCls(shotOn)} />
            </button>
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            AI Auto-Subtitle (screenshot)
            <input
              type="number"
              min={5}
              value={shotInterval}
              disabled={shotOn}
              onChange={(e) => setShotInterval(parseInt(e.target.value || '60', 10))}
              className="w-16 text-xs bg-white/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100 disabled:opacity-50"
            />
            s
          </label>

          {/* Recognition / output language — one setting drives OCR → translate → TTS. */}
          <label
            className="flex items-center gap-2 select-none"
            title="The recognition language: OCR reads the screen in this language, and the subtitle is generated in it (OCR → translate → TTS all use this one setting)."
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            Language
            <select
              value={lang}
              onChange={(e) => handleLangChange(e.target.value)}
              className="text-xs bg-white/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none" title="Copied sentences are rewritten in English by the AI and enqueued.">
            <button onClick={toggleClipboard} disabled={switching === 'clipboard'} className={switchCls(clipOn)}>
              <span className={knobCls(clipOn)} />
            </button>
            <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
            AI Clipboard
          </label>
        </div>

        {playbackOn && playingText && (
          <div className="flex-1 min-w-0 text-xs font-mono text-emerald-500 truncate" title={playingText}>
            ♪ {playingText}
          </div>
        )}
      </section>

      <PcPipelineStatusPanels variant="subtitle" shotInterval={shotInterval} />

      {/* ===================== Queue tab ===================== */}
      {tab === 'queue' && (
        <>
          <section className="pc-glass p-5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="Enter text to synthesize…"
                className="flex-1 text-sm bg-white/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button
                onClick={handleAiCompose}
                disabled={aiBusy || submitting}
                className="px-4 py-2 pc-glass hover:bg-violet-500/10 disabled:opacity-50 text-violet-500 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1"
                title="Let AI draft or polish the sentence (probed provider)">
                {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI Compose
              </button>
              <button
                onClick={handleAdd}
                disabled={!text.trim() || submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-1">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Add TTS
              </button>
            </div>
            {notice && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
            )}
          </section>

          <section className="pc-glass overflow-hidden">
            <div className="p-5 border-b border-slate-200/40 dark:border-white/5 flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Layers className="w-4 h-4 text-indigo-500" /> Queue
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">{total}</span>
              </h2>
              <div className="flex items-center gap-3">
                {currentIndex != null && (
                  <span className="text-[11px] font-mono text-sky-500">current #{currentIndex}</span>
                )}
                <button
                  onClick={handleClear}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 transition"
                  title="Clear queue">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-5 max-h-[420px] overflow-auto">
              {loading && items.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <p className="text-xs">Loading queue…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500">
                  <Layers2 className="w-8 h-8 opacity-40 mb-2 text-indigo-500" />
                  <p className="text-xs italic">Queue is empty — add some text above.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200/40 dark:border-white/5">
                      <th className="pb-3 font-semibold">#</th>
                      <th className="pb-3 font-semibold">Text</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold text-center">Plays</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {items.map((item) => {
                      const isCurrent = currentIndex != null && item.index === currentIndex;
                      const st = statusLabel(item.status);
                      return (
                        <tr
                          key={item.id}
                          className={`group hover:bg-indigo-500/5 transition-colors ${isCurrent ? 'bg-indigo-500/10' : ''}`}>
                          <td className="py-3 font-mono opacity-60 font-semibold">{String(item.index).padStart(3, '0')}</td>
                          <td className="py-3 max-w-xs">
                            <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{item.text}</p>
                            {item.metadata?.ai && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono text-violet-500" title={`Generated by ${item.metadata.ai}`}>
                                <Sparkles className="w-2.5 h-2.5" /> {item.metadata.ai}
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${CATEGORY_CLS[item.category] ?? 'bg-slate-500/15 text-slate-500'}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-center">{item.playCount}</td>
                          <td className="py-3">
                            <span className={`text-[9px] font-bold uppercase ${st.cls}`}>{st.text}</span>
                          </td>
                          <td className="py-3 text-right space-x-1">
                            {item.audioUrl && (
                              <button
                                onClick={() => handleBrowserPlay(item)}
                                className={`p-1 rounded transition ${
                                  browserPlaying === item.id
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : 'bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-emerald-500'
                                }`}
                                title={browserPlaying === item.id ? 'Stop' : 'Play here'}>
                                {browserPlaying === item.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1 rounded bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-rose-500 transition"
                              title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-5 bg-slate-200/40 dark:bg-black/30 border-t border-slate-200/40 dark:border-white/5 flex gap-6">
              <div>
                <div className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">{total}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total items</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-emerald-500">+{todayCount}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">Added today</div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ===================== Subtitle tab ===================== */}
      {tab === 'stage' && (
        <div className="grid grid-cols-12 gap-6 lg:items-start">
          <div className="col-span-12 lg:col-span-8">
            <section className="pc-glass p-8 min-h-[320px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-md font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Captions className="w-5 h-5 text-indigo-500" />
                  {playbackOn && playingText ? 'Now playing' : 'Now showing'}
                </h2>
                {current && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                    #{String(current.index).padStart(3, '0')}
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center text-center">
                {stageText ? (
                  <p className="text-2xl md:text-3xl font-semibold leading-relaxed text-slate-800 dark:text-zinc-100 max-w-2xl">
                    {stageText}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-500">No subtitle to display.</p>
                )}
              </div>
              {current && (
                <div className="mt-6 text-[11px] font-mono text-slate-500 flex items-center justify-center gap-3">
                  <span>#{String(current.index).padStart(3, '0')}</span>
                  <span className="uppercase">{current.category}</span>
                  {current.created && <span>{new Date(current.created).toLocaleTimeString()}</span>}
                  {current.metadata?.ai && (
                    <span className="text-violet-500" title={`Generated by ${current.metadata.ai}`}>
                      via {current.metadata.ai}
                    </span>
                  )}
                </div>
              )}
              {stageText && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <button
                    onClick={handleAiExplain}
                    disabled={aiExplainBusy}
                    className="px-3 py-1.5 pc-glass hover:bg-violet-500/10 disabled:opacity-50 text-violet-500 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    title="Explain this sentence with AI (probed provider)">
                    {aiExplainBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    AI Explain
                  </button>
                  {aiExplain && (
                    <div className="w-full max-w-2xl text-left rounded-2xl p-4 bg-violet-500/5 border border-violet-500/20">
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{aiExplain}</p>
                      {aiMeta && (
                        <p className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">{aiMeta}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <section className="pc-glass p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2 py-2">
                Latest items
              </h3>
              <div className="space-y-1 max-h-[420px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 py-10">
                    <Layers2 className="w-7 h-7 opacity-40 mb-2 text-indigo-500" />
                    <p className="text-xs italic px-2">Queue is empty.</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const Icon = CATEGORY_ICON[item.category] ?? FileText;
                    const active = current && item.index === current.index;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item.index)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition ${
                          active
                            ? 'bg-indigo-500/15 text-indigo-500'
                            : 'hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                        }`}>
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="flex-1 text-xs truncate">{item.text}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcVoiceSubtitlePage;
