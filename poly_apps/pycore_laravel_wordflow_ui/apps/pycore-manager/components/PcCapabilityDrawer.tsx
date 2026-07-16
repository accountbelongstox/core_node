/**
 * PcCapabilityDrawer — Queue Center capability priority/options drawer.
 * GET/POST /api/local/capabilities/settings
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SlidersHorizontal, RefreshCw, X, Loader2, AlertTriangle, Save, ChevronUp, ChevronDown,
  Mic, AudioLines, Image as ImageIcon, Languages,
} from 'lucide-react';
import { pycoreApi, ttsEngineUiState, ttsEngineBadgeLabel } from '../../../core/api-libs/pycore';
import type { PcCapabilitySettings, PcCapabilityBlock, PcCapabilityKey, PcCapabilityOptions } from '../../../core/api-libs/pycore';

const CAP_KEYS: PcCapabilityKey[] = ['stt', 'tts', 'sentence_tts', 'word_tts', 'image', 'translation'];
const CAP_ICON: Record<PcCapabilityKey, React.FC<{ className?: string }>> = {
  stt: Mic, tts: AudioLines, image: ImageIcon, translation: Languages,
  sentence_tts: AudioLines, word_tts: AudioLines,
};
const CAP_DEFAULT_PRIORITY: Record<PcCapabilityKey, string[]> = {
  stt: ['whisper', 'ai', 'vosk'],
  tts: ['gptsovits', 'streamelements', 'sherpa', 'melotts', 'edge', 'gtts_web', 'azure', 'chattts', 'cosyvoice', 'fishspeech', 'qwen3tts', 'bark', 'parler', 'voxcpm2', 'kokoro', 'f5tts'],
  // Sentence TTS: qwen3tts-first (high-quality neural voices for sentence audio).
  sentence_tts: ['qwen3tts', 'chattts', 'cosyvoice', 'fishspeech', 'bark', 'parler', 'voxcpm2', 'kokoro', 'gptsovits', 'f5tts', 'melotts', 'sherpa', 'edge', 'streamelements', 'gtts_web', 'azure'],
  // Word TTS: edge-first (fast lightweight single-word pronunciation).
  word_tts: ['edge', 'streamelements', 'gtts_web', 'sherpa', 'melotts', 'gptsovits', 'chattts', 'cosyvoice', 'fishspeech', 'qwen3tts', 'bark', 'parler', 'voxcpm2', 'kokoro', 'f5tts', 'azure'],
  image: ['zhipuai', 'dashscope', 'pollinations'],
  translation: ['ecdict', 'wordnet', 'google', 'ai'],
};
/** Clear English titles for each capability block (the translation keys are not
 *  defined in the i18n tables, so raw keys would show otherwise). */
const CAP_LABEL: Record<PcCapabilityKey, string> = {
  stt: 'Speech-to-Text',
  tts: 'Text-to-Speech (Default)',
  sentence_tts: 'Text-to-Speech (Sentence)',
  word_tts: 'Text-to-Speech (Word)',
  image: 'Image Generation',
  translation: 'Translation',
};

export const PcCapabilityDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t } = useTranslation('pc');
  const [settings, setSettings] = useState<PcCapabilitySettings | null>(null);
  // Local editable copy (priority order + options) per capability.
  const [draft, setDraft] = useState<Record<PcCapabilityKey, PcCapabilityBlock>>(() =>
    CAP_KEYS.reduce((acc, k) => {
      acc[k] = { priority: [...CAP_DEFAULT_PRIORITY[k]], available: {}, installed: {}, setup_reasons: {}, options: {} };
      return acc;
    }, {} as Record<PcCapabilityKey, PcCapabilityBlock>));
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCap, setSavingCap] = useState<PcCapabilityKey | null>(null);
  const [notice, setNotice] = useState<{ cap: PcCapabilityKey; ok: boolean; text: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setAvailable(null);
    setLoading(true);
    try {
      const r = await pycoreApi.getCapabilitySettings();
      if (!mounted.current) return;
      if (!r || (r as any).success === false || !r.tts) throw new Error((r as any)?.error || 'unavailable');
      setSettings(r);
      setDraft(CAP_KEYS.reduce((acc, k) => {
        const b = (r as any)[k] as PcCapabilityBlock | undefined;
        acc[k] = {
          priority: Array.isArray(b?.priority) && b!.priority.length ? [...b!.priority] : [...CAP_DEFAULT_PRIORITY[k]],
          available: b?.available ?? {},
          installed: b?.installed ?? {},
          setup_reasons: b?.setup_reasons ?? {},
          options: b?.options ?? {},
        };
        return acc;
      }, {} as Record<PcCapabilityKey, PcCapabilityBlock>));
      setAvailable(true);
    } catch {
      if (mounted.current) setAvailable(false);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Load once when the drawer is first opened (and on explicit reload).
  useEffect(() => { if (open && available === null) load(); }, [open, available, load]);

  const move = (cap: PcCapabilityKey, idx: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const list = [...prev[cap].priority];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[idx], list[j]] = [list[j], list[idx]];
      return { ...prev, [cap]: { ...prev[cap], priority: list } };
    });
  };

  const setOption = (cap: PcCapabilityKey, key: string, value: number) => {
    setDraft((prev) => ({ ...prev, [cap]: { ...prev[cap], options: { ...prev[cap].options, [key]: value } } }));
  };

  const setBoolOption = (cap: PcCapabilityKey, key: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [cap]: { ...prev[cap], options: { ...prev[cap].options, [key]: value } } }));
  };

  const save = useCallback(async (cap: PcCapabilityKey) => {
    setSavingCap(cap);
    setNotice(null);
    try {
      // Only the default tts block carries options; sentence_tts/word_tts have
      // no options section, so send priority-only for them.
      const patch: { priority: string[]; options?: PcCapabilityOptions } = {
        priority: draft[cap].priority,
      };
      if (cap === 'tts') patch.options = draft[cap].options;
      const r = await pycoreApi.saveCapabilitySettings(cap, patch);
      if (!mounted.current) return;
      if (!r || (r as any).success === false) {
        const detail = (r as any)?.error ?? (r as any)?.detail;
        throw new Error(typeof detail === 'string' ? detail : 'save rejected');
      }
      // Reflect the returned block (server may have appended omitted engines).
      setDraft((prev) => ({
        ...prev,
        [cap]: {
          priority: Array.isArray(r.priority) && r.priority.length ? [...r.priority] : prev[cap].priority,
          available: r.available ?? prev[cap].available,
          installed: r.installed ?? prev[cap].installed,
          setup_reasons: r.setup_reasons ?? prev[cap].setup_reasons,
          options: r.options ?? prev[cap].options,
        },
      }));
      setNotice({ cap, ok: true, text: `${CAP_LABEL[cap]} saved` });
    } catch (e: any) {
      if (mounted.current) setNotice({ cap, ok: false, text: e?.message || 'pycore unreachable' });
    } finally {
      if (mounted.current) setSavingCap(null);
    }
  }, [draft]);

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose}
        className={`fixed inset-0 z-[120] bg-slate-900/30 backdrop-blur-[1px] transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      {/* panel */}
      <aside
        className={`fixed top-0 right-0 z-[121] h-full w-full max-w-md pc-glass shadow-2xl border-l border-slate-300/40 dark:border-white/10 transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center gap-2 p-4 border-b border-slate-300/30 dark:border-white/10">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('queueCenter.drawer.title')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.drawer.subtitle')}</p>
          </div>
          <button onClick={load} disabled={loading}
            className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50" title={t('queueCenter.drawer.reload')}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition" title={t('queueCenter.drawer.close')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {available === false && (
            <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{t('queueCenter.drawer.unavailable')}</span>
            </div>
          )}
          {available === null && loading && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.drawer.loading')}
            </p>
          )}

          {CAP_KEYS.map((cap) => {
            const CIcon = CAP_ICON[cap];
            const block = draft[cap];
            const avail = block.available ?? {};
            const inst = block.installed ?? {};
            const reasons = block.setup_reasons ?? {};
            const isTts = cap === 'tts';
            const badgeLabels = {
              ready: t('queueCenter.drawer.available'),
              setup: t('queueCenter.drawer.needsSetup'),
              missing: t('queueCenter.drawer.notInstalled'),
            };
            return (
              <section key={cap} className="rounded-2xl p-3 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <CIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{CAP_LABEL[cap]}</h3>
                  <button onClick={() => save(cap)} disabled={savingCap === cap}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shrink-0">
                    {savingCap === cap ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {savingCap === cap ? t('queueCenter.drawer.saving') : t('queueCenter.drawer.save')}
                  </button>
                </div>

                {/* engine priority (re-orderable) */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('queueCenter.drawer.priority')}</div>
                  <p className="text-[10px] text-slate-400 mb-1.5">{t('queueCenter.drawer.priorityHint')}</p>
                  <ul className="space-y-1">
                    {block.priority.map((engine, idx) => {
                      const uiState = ttsEngineUiState(inst[engine], avail[engine] === true);
                      const badgeClass =
                        uiState === 'ready'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : uiState === 'setup'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-500/15 text-slate-400';
                      const dotClass =
                        uiState === 'ready'
                          ? 'bg-emerald-500'
                          : uiState === 'setup'
                            ? 'bg-amber-500'
                            : 'bg-slate-400';
                      const hint = reasons[engine];
                      return (
                        <li key={engine} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/60 dark:bg-white/5 border border-slate-300/40 dark:border-white/5">
                          <span className="text-[10px] font-mono text-slate-400 w-4 text-center shrink-0">{idx + 1}</span>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate" title={hint || engine}>{engine}</span>
                          <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide shrink-0 ${badgeClass}`}
                            title={hint || undefined}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                            {ttsEngineBadgeLabel(uiState, badgeLabels)}
                          </span>
                          <div className="flex flex-col shrink-0">
                            <button onClick={() => move(cap, idx, -1)} disabled={idx === 0}
                              className="p-0.5 rounded text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition" title={t('queueCenter.drawer.moveUp')}>
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => move(cap, idx, 1)} disabled={idx === block.priority.length - 1}
                              className="p-0.5 rounded text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition" title={t('queueCenter.drawer.moveDown')}>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* options (TTS tuning only; others note "no options") */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('queueCenter.drawer.options')}</div>
                  {isTts ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <label className="block">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5" title={t('queueCenter.drawer.synthTimeoutHint')}>
                          {t('queueCenter.drawer.synthTimeout')}
                        </span>
                        <input type="number" min={5} max={120} step={1}
                          value={typeof block.options.synth_timeout_s === 'number' ? block.options.synth_timeout_s : 20}
                          onChange={(e) => setOption('tts', 'synth_timeout_s', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5" title={t('queueCenter.drawer.edgeCooldownHint')}>
                          {t('queueCenter.drawer.edgeCooldown')}
                        </span>
                        <input type="number" min={0} max={3600} step={5}
                          value={typeof block.options.edge_cooldown_s === 'number' ? block.options.edge_cooldown_s : 300}
                          onChange={(e) => setOption('tts', 'edge_cooldown_s', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
                      </label>
                      <label className="col-span-2 flex items-center gap-2 text-[10px] text-slate-500">
                        <input type="checkbox"
                          checked={block.options.server_auto_manage !== false}
                          onChange={(e) => setBoolOption('tts', 'server_auto_manage', e.target.checked)}
                          className="rounded border-slate-300" />
                        {t('pipeline.ttsServerAuto')}
                      </label>
                      <label className="col-span-2 flex items-center gap-2 text-[10px] text-slate-500">
                        <input type="checkbox"
                          checked={block.options.server_single_active !== false}
                          onChange={(e) => setBoolOption('tts', 'server_single_active', e.target.checked)}
                          className="rounded border-slate-300" />
                        {t('pipeline.ttsServerSingle')}
                      </label>
                      <label className="block col-span-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                          {t('pipeline.ttsServerIdle')} (s)
                        </span>
                        <input type="number" min={0} max={600} step={5}
                          value={typeof block.options.server_idle_shutdown_s === 'number' ? block.options.server_idle_shutdown_s : 30}
                          onChange={(e) => setOption('tts', 'server_idle_shutdown_s', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
                      </label>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">{t('queueCenter.drawer.noOptions')}</p>
                  )}
                </div>

                {notice && notice.cap === cap && (
                  <p className={`text-[11px] ${notice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{notice.text}</p>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
};

export default PcCapabilityDrawer;
