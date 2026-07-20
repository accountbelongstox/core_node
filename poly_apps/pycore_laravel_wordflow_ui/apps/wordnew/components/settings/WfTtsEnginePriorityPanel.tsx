/**
 * WfTtsEnginePriorityPanel - Settings card to re-order the TTS engine try-list.
 * Talks to pycore DIRECTLY on :59000 (via pycoreApi). GET/POST /api/local/capabilities/settings.
 * engine list + order are fetched live; engines are tried top -> bottom.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines, ChevronUp, ChevronDown, Save, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { ElementTheme } from '../../WfNewTypes';
import { pycoreApi, ttsEngineUiState, ttsEngineBadgeLabel } from '../../../../core/api-libs/pycore';

/** Fallback try-order ONLY when the GET fails (mirrors pycore
 *  tts_orchestrator._DEFAULT_PRIORITY: gptsovits-first). */
const DEFAULT_TTS_PRIORITY: string[] = [
  'gptsovits', 'streamelements', 'sherpa', 'melotts', 'edge', 'gtts_web', 'azure',
  'chattts', 'cosyvoice', 'fishspeech', 'qwen3tts', 'bark', 'voxcpm2', 'kokoro', 'f5tts',
];

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfTtsEnginePriorityPanel: React.FC<Props> = ({ activeTheme, trans }) => {
  const [draft, setDraft] = useState<string[]>([...DEFAULT_TTS_PRIORITY]);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [setupReasons, setSetupReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setUnreachable(false);
    setNotice(null);
    try {
      const r = await pycoreApi.getCapabilitySettings();
      if (!mounted.current) return;
      // pycore returns the four capability blocks; tts must be present. A
      // missing/falsey block means pycore is unreachable or misconfigured.
      if (!r || (r as any).success === false || !r.tts) {
        throw new Error((r as any)?.error || 'unavailable');
      }
      const tts = r.tts;
      setAvailable(tts.available ?? {});
      setInstalled(tts.installed ?? {});
      setSetupReasons(tts.setup_reasons ?? {});
      // Order from the saved priority; fall back to the default list when empty.
      setDraft(
        Array.isArray(tts.priority) && tts.priority.length
          ? [...tts.priority]
          : [...DEFAULT_TTS_PRIORITY],
      );
    } catch {
      if (mounted.current) {
        setUnreachable(true);
        setDraft([...DEFAULT_TTS_PRIORITY]);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const move = (idx: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const list = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[idx], list[j]] = [list[j], list[idx]];
      return list;
    });
  };

  const save = useCallback(async () => {
    setSaving(true);
    setNotice(null);
    try {
      const r = await pycoreApi.saveCapabilitySettings('tts', { priority: draft });
      if (!mounted.current) return;
      if (!r || (r as any).success === false) {
        const detail = (r as any)?.error ?? (r as any)?.detail;
        throw new Error(typeof detail === 'string' ? detail : 'save rejected');
      }
      // Reflect the server-returned order + availability (it may append omitted engines).
      setDraft(Array.isArray(r.priority) && r.priority.length ? [...r.priority] : draft);
      setAvailable(r.available ?? available);
      setInstalled(r.installed ?? installed);
      setSetupReasons(r.setup_reasons ?? setupReasons);
      setNotice({ ok: true, text: trans('ttsPriority.saved') });
    } catch {
      if (mounted.current) setNotice({ ok: false, text: trans('ttsPriority.saveFailed') });
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [draft, available, installed, setupReasons, trans]);

  return (
    <div className={`p-6 sm:p-8 rounded-3xl ${activeTheme.cardClass} space-y-4 shadow-md`}>
      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
        <AudioLines className="w-5 h-5 text-indigo-500" />
        <h3 className="text-base font-extrabold tracking-tight text-indigo-950 dark:text-white">
          {trans('ttsPriority.title')}
        </h3>
        <button type="button" onClick={() => void load()} disabled={loading || saving}
          className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition disabled:opacity-50 cursor-pointer"
          title={trans('ttsPriority.reload')}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
        {trans('ttsPriority.hint')}
      </p>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{trans('ttsPriority.unreachable')}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {trans('ttsPriority.loading')}
        </p>
      ) : (
        <ul className="space-y-1">
          {draft.map((engine, idx) => {
            const uiState = ttsEngineUiState(installed[engine], available[engine] === true);
            const badgeClass =
              uiState === 'ready'
                ? 'bg-emerald-500/15 text-emerald-500'
                : uiState === 'setup'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-zinc-500/15 text-zinc-400';
            const dotClass =
              uiState === 'ready'
                ? 'bg-emerald-500'
                : uiState === 'setup'
                  ? 'bg-amber-500'
                  : 'bg-zinc-400';
            const hint = setupReasons[engine];
            const badgeLabels = {
              ready: trans('ttsPriority.available'),
              setup: trans('ttsPriority.needsSetup'),
              missing: trans('ttsPriority.notInstalled'),
            };
            return (
              <li key={engine} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                <span className="text-[10px] font-mono text-zinc-400 w-4 text-center shrink-0">{idx + 1}</span>
                <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200 truncate" title={hint || engine}>{engine}</span>
                <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide shrink-0 ${badgeClass}`}
                  title={hint || undefined}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  {ttsEngineBadgeLabel(uiState, badgeLabels)}
                </span>
                <div className="flex flex-col shrink-0">
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="p-0.5 rounded text-zinc-400 hover:text-indigo-500 disabled:opacity-30 transition cursor-pointer"
                    title={trans('ttsPriority.moveUp')}>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === draft.length - 1}
                    className="p-0.5 rounded text-zinc-400 hover:text-indigo-500 disabled:opacity-30 transition cursor-pointer"
                    title={trans('ttsPriority.moveDown')}>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={() => void save()} disabled={saving || loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition cursor-pointer">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? trans('ttsPriority.saving') : trans('ttsPriority.save')}
        </button>
        {notice && (
          <p className={`text-[11px] ${notice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{notice.text}</p>
        )}
      </div>
    </div>
  );
};

export default WfTtsEnginePriorityPanel;
