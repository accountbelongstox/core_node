/**
 * PcRecordsPanel — the unified Records timeline.
 *
 * Merges THREE shared cross-runtime stores into one newest-first feed:
 *   - AI usage    (/ai/usage)          -> text / vision / probe records
 *   - image gen   (/ai/image/history)  -> image records (thumbnail -> lightbox)
 *   - speech      (/speech/history)    -> tts / stt clips (inline audio playback)
 *
 * Every media row can be PLAYED (audio) or OPENED in a lightbox (image), shows its
 * on-disk path, and has an "Open location" button that reveals the file's folder in
 * the OS file manager (path resolved server-side by id — never an arbitrary path).
 * Kind filter chips scope the feed. Auto-polls every 10s; manual refresh + clear.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Loader2, RefreshCw, Trash2, Play, Pause, FolderOpen,
  MessageSquare, Eye, Image as ImageIcon, AudioLines, Mic, ScanText,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { AiUsageRecord, ImageHistoryEntry, SpeechRecord } from '../../../core/api-libs/pycore';
import { fetchPycoreBlobUrl } from '../../../core/api-libs/pycore/PycoreBlob';
import { PcBlobImage } from './PcBlobMedia';
import { PcImageLightbox } from './PcAiShared';
import { logInfo, logSuccess, logError } from '../../../core/logstore/logStore';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';

const LOG_SRC = 'pc-records';
const FALLBACK_POLL_MS = 60_000;

type UnifiedKind = 'text' | 'vision' | 'probe' | 'image' | 'tts' | 'stt';

interface UnifiedRecord {
  uid: string;
  ts: number;
  kind: UnifiedKind;
  who: string;            // provider (AI) or engine (speech)
  model?: string;
  detail?: string;        // prompt / text / source
  success: boolean;
  latency_ms: number | null;
  runtime?: string;
  imageId?: string;       // image rows
  audioId?: string;       // tts/stt rows
  path?: string;          // on-disk location (speech has absolute; image relative)
}

const KIND_META: Record<UnifiedKind, { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
  text: { label: 'text', cls: 'bg-indigo-500/15 text-indigo-500', Icon: MessageSquare },
  vision: { label: 'vision', cls: 'bg-violet-500/15 text-violet-500', Icon: Eye },
  probe: { label: 'probe', cls: 'bg-sky-500/15 text-sky-500', Icon: ScanText },
  image: { label: 'image', cls: 'bg-amber-500/15 text-amber-500', Icon: ImageIcon },
  tts: { label: 'tts', cls: 'bg-emerald-500/15 text-emerald-500', Icon: AudioLines },
  stt: { label: 'stt', cls: 'bg-cyan-500/15 text-cyan-500', Icon: Mic },
};
const FILTERS: Array<{ key: UnifiedKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'text', label: 'Text' },
  { key: 'vision', label: 'Vision' },
  { key: 'probe', label: 'Probe' },
  { key: 'image', label: 'Image' },
  { key: 'tts', label: 'TTS' },
  { key: 'stt', label: 'STT' },
];

function hhmmss(ts: number): string {
  try { return new Date(ts * 1000).toLocaleTimeString(); } catch { return ''; }
}

export const PcRecordsPanel: React.FC = () => {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<UnifiedKind | 'all'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; caption: React.ReactNode } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const [u, im, sp] = await Promise.allSettled([
      pycoreApi.getAiUsage(150),
      pycoreApi.getImageHistory(80),
      pycoreApi.getSpeechHistory(80),
    ]);
    const merged: UnifiedRecord[] = [];

    if (u.status === 'fulfilled' && u.value?.data?.entries) {
      (u.value.data.entries as AiUsageRecord[]).forEach((e, i) => merged.push({
        uid: `u_${e.ts}_${i}`, ts: e.ts, kind: (e.kind as UnifiedKind) || 'text',
        who: e.provider, model: e.model, detail: e.source, success: e.success,
        latency_ms: e.latency_ms, runtime: e.runtime,
      }));
    }
    if (im.status === 'fulfilled' && im.value?.entries) {
      (im.value.entries as ImageHistoryEntry[]).forEach((e) => merged.push({
        uid: `i_${e.id}`, ts: e.ts, kind: 'image', who: e.provider, model: e.model,
        detail: e.prompt, success: e.ok, latency_ms: e.latency_ms, runtime: e.origin,
        imageId: e.id, path: e.file,
      }));
    }
    if (sp.status === 'fulfilled' && sp.value?.entries) {
      (sp.value.entries as SpeechRecord[]).forEach((e) => merged.push({
        uid: `s_${e.id}`, ts: e.ts, kind: e.kind, who: e.engine, model: e.language,
        detail: e.text, success: e.ok, latency_ms: e.latency_ms, runtime: e.origin,
        audioId: e.id, path: e.path,
      }));
    }

    merged.sort((a, b) => b.ts - a.ts);
    setRecords(merged);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useTopicDrivenRefresh(['operation.changed'], () => load(), { fallbackMs: FALLBACK_POLL_MS });

  const togglePlay = useCallback((rec: UnifiedRecord) => {
    if (!rec.audioId) return;
    const el = audioRef.current;
    if (!el) return;
    if (playingId === rec.audioId && !el.paused) {
      el.pause();
      setPlayingId(null);
      return;
    }
    // Fetch the clip bytes over WS (data: URL) then play — no HTTP element src.
    void fetchPycoreBlobUrl(pycoreApi.speechHistoryFileUrl(rec.audioId)).then((src) => {
      el.src = src;
      el.play().then(() => setPlayingId(rec.audioId!)).catch((e) => {
        logError(LOG_SRC, `playback failed: ${e?.message || e}`);
      });
    });
  }, [playingId]);

  const reveal = useCallback(async (rec: UnifiedRecord) => {
    try {
      const res = rec.audioId
        ? await pycoreApi.revealSpeech(rec.audioId)
        : rec.imageId ? await pycoreApi.revealImage(rec.imageId) : null;
      if (res?.success) logSuccess(LOG_SRC, `opened location: ${res.path || ''}`);
      else logError(LOG_SRC, `could not open location${res?.error ? `: ${res.error}` : ''}`);
    } catch (e) {
      logError(LOG_SRC, `reveal failed: ${(e as Error)?.message || e}`);
    }
  }, []);

  const openImage = useCallback(async (rec: UnifiedRecord) => {
    if (!rec.imageId) return;
    const src = await fetchPycoreBlobUrl(pycoreApi.imageHistoryFileUrl(rec.imageId));
    if (!src) {
      logError(LOG_SRC, 'image bytes are unavailable over RPC v2');
      return;
    }
    setLightbox({
      src,
      caption: <span className="font-mono">{rec.who}{rec.model ? ` · ${rec.model}` : ''} — {rec.detail}</span>,
    });
  }, []);

  const remove = useCallback(async (rec: UnifiedRecord) => {
    try {
      if (rec.audioId) await pycoreApi.deleteSpeechHistory(rec.audioId);
      else if (rec.imageId) await pycoreApi.deleteImageHistory(rec.imageId);
      setRecords((r) => r.filter((x) => x.uid !== rec.uid));
    } catch (e) {
      logError(LOG_SRC, `delete failed: ${(e as Error)?.message || e}`);
    }
  }, []);

  const clearMedia = useCallback(async () => {
    try {
      await Promise.allSettled([pycoreApi.clearSpeechHistory(), pycoreApi.clearImageHistory()]);
      logInfo(LOG_SRC, 'cleared image + speech history');
      void load(true);
    } catch (e) {
      logError(LOG_SRC, `clear failed: ${(e as Error)?.message || e}`);
    }
  }, [load]);

  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.kind === filter)),
    [records, filter],
  );

  return (
    <section className="pc-glass p-5 space-y-3">
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId((p) => p)}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Activity className="w-4 h-4 text-indigo-500" /> Records
          <span className="text-[10px] font-mono text-slate-400">{records.length}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button" onClick={clearMedia}
            title="Clear image + speech history (usage log is append-only)"
            className="p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button" onClick={() => { void load(true); }} disabled={refreshing}
            title="Refresh records"
            className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Kind filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = f.key === 'all' ? records.length : records.filter((r) => r.kind === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition ${
                active
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-500'
                  : 'pc-glass border-slate-400/15 text-slate-400 hover:text-slate-200'
              }`}>
              {f.label}<span className="ml-1 opacity-60 font-mono">{n}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5 py-3">
          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> Loading records…
        </p>
      ) : shown.length === 0 ? (
        <p className="text-[11px] italic text-slate-400 py-3">No records yet — run a test or generate something.</p>
      ) : (
        <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
          {shown.map((rec) => {
            const meta = KIND_META[rec.kind];
            const { Icon } = meta;
            const isPlaying = playingId === rec.audioId;
            return (
              <div
                key={rec.uid}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-500/5 text-[11px]">
                <span className="font-mono text-slate-400 shrink-0 w-[58px]">{hhmmss(rec.ts)}</span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rec.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${meta.cls}`}>
                  <Icon className="w-3 h-3" /> {meta.label}
                </span>

                {/* image thumbnail */}
                {rec.imageId && (
                  <button
                    type="button"
                    onClick={() => { void openImage(rec); }}
                    title="Open image"
                    className="shrink-0 w-8 h-8 rounded overflow-hidden border border-slate-400/20 hover:border-indigo-500/50">
                    <PcBlobImage path={pycoreApi.imageHistoryFileUrl(rec.imageId)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                )}

                {/* audio play */}
                {rec.audioId && (
                  <button
                    type="button" onClick={() => togglePlay(rec)} title={isPlaying ? 'Pause' : 'Play'}
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                )}

                <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">{rec.who || '—'}</span>
                {rec.model && <span className="text-slate-400 font-mono shrink-0">{rec.model}</span>}
                <span className="text-slate-400 truncate flex-1" title={rec.detail}>{rec.detail}</span>

                {rec.latency_ms != null && <span className="font-mono text-slate-400 shrink-0">{Math.round(rec.latency_ms)}ms</span>}
                {rec.runtime && <span className="text-[9px] uppercase font-bold text-slate-400/70 shrink-0">{rec.runtime}</span>}

                {/* reveal + delete (media rows only) */}
                {(rec.imageId || rec.audioId) && (
                  <>
                    <button
                      type="button" onClick={() => reveal(rec)} title={rec.path || 'Open file location'}
                      className="shrink-0 p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10">
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button" onClick={() => remove(rec)} title="Delete record"
                      className="shrink-0 p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PcImageLightbox
        open={!!lightbox}
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
};

export default PcRecordsPanel;
