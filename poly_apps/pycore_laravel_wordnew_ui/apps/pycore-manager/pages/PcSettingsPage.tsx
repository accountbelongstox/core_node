/**
 * PcSettingsPage — pycore BACKEND settings only.
 *
 * The shell owns global theme, dark mode and language, so this page drops the
 * appearance/accent/glass/language UI and keeps only backend-persisted settings:
 * system-settings (pycoreApi.getSystemSettings/setSystemSettings —
 * monitorClipboard, scheduledScreenshot, screenshotInterval, notebooklmAutoConvert),
 * the Laravel endpoint selection (PcLaravelEndpointSwitcher — pycore-owned
 * `laravel_api.*` HTTPs), task engine tuning, and
 * auto-start on boot (pycoreApi.getAutostart/setAutostart). Every backend call
 * is guarded; an inline "pycore unreachable" state is shown when the backend
 * (:59000) is offline. Local React state, pycoreApi, lucide-react and
 * Tailwind / `.pc-glass` only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings2, Power, RefreshCw, Clipboard, Image as ImageIcon, FileText,
  AlertTriangle, Info, Wifi, Volume2, Save, Loader2,
} from 'lucide-react';
import {
  pycoreApi,
  PYCORE_HEALTH_EVENT, getPycoreHealth, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
} from '@/apps/pycore-manager/api';
import type {
  AutostartStatus, AutostartTarget, PycoreHealthState, TtsSettings,
} from '@/apps/pycore-manager/api';
import PcLaravelEndpointSwitcher from '../components/PcLaravelEndpointSwitcher';

interface SystemSettings {
  monitorClipboard: boolean;
  scheduledScreenshot: boolean;
  screenshotInterval: number; // seconds
  notebooklmAutoConvert: boolean;
}

const DEFAULTS: SystemSettings = {
  monitorClipboard: false,
  scheduledScreenshot: false,
  screenshotInterval: 60,
  notebooklmAutoConvert: false,
};

const isAutostart = (s: any): s is AutostartStatus =>
  !!s && typeof s.enabled === 'boolean' && typeof s.supported === 'boolean';

interface TtsTuningForm {
  synth_timeout_s: number;
  edge_cooldown_s: number;
}

const TTS_TUNING_DEFAULTS: TtsTuningForm = {
  synth_timeout_s: 20,
  edge_cooldown_s: 300,
};

const PcSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [autostart, setAutostart] = useState<AutostartStatus | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);
  // Desired launch target; mirrors the backend once known, drives the selector.
  const [autostartTarget, setAutostartTarget] = useState<AutostartTarget>('pyservice');

  // --- pycore reachability (frontend-local, not backend-persisted) --------- #
  const [pcHealth, setPcHealth] = useState<PycoreHealthState>(getPycoreHealth());
  const [pcChecking, setPcChecking] = useState(false);
  const [recheckSec, setRecheckSec] = useState(() => Math.round(getPycoreRecheckIntervalMs() / 1000));

  useEffect(() => {
    const onHealth = () => setPcHealth(getPycoreHealth());
    window.addEventListener(PYCORE_HEALTH_EVENT, onHealth);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, onHealth);
  }, []);

  const recheckConnection = async () => {
    if (pcChecking) return;
    setPcChecking(true);
    try { await recheckPycoreNow(); } finally { setPcChecking(false); }
  };

  // Persist the offline recheck interval; the retry loop reads it fresh on
  // every tick. Re-read after set to reflect clamping.
  const commitRecheckInterval = () => {
    setPycoreRecheckIntervalMs(recheckSec * 1000);
    setRecheckSec(Math.round(getPycoreRecheckIntervalMs() / 1000));
  };

  // --- load system settings ---------------------------------------------- #
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pycoreApi.getSystemSettings();
      const s = (r?.settings ?? {}) as Record<string, unknown>;
      setSettings({
        monitorClipboard: typeof s.monitorClipboard === 'boolean' ? s.monitorClipboard : DEFAULTS.monitorClipboard,
        scheduledScreenshot: typeof s.scheduledScreenshot === 'boolean' ? s.scheduledScreenshot : DEFAULTS.scheduledScreenshot,
        screenshotInterval: typeof s.screenshotInterval === 'number' ? s.screenshotInterval : DEFAULTS.screenshotInterval,
        notebooklmAutoConvert: typeof s.notebooklmAutoConvert === 'boolean' ? s.notebooklmAutoConvert : DEFAULTS.notebooklmAutoConvert,
      });
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- TTS tuning ---------------------------------------------------------- #
  const [ttsTuning, setTtsTuning] = useState<TtsTuningForm>(TTS_TUNING_DEFAULTS);
  // null = loading, false = unavailable / pycore offline, true = loaded.
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);
  const [ttsSaving, setTtsSaving] = useState(false);
  const [ttsNotice, setTtsNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadTtsTuning = useCallback(async () => {
    setTtsAvailable(null);
    try {
      const s = await pycoreApi.getTtsSettings();
      if (!s || (s as any).success === false || typeof s.synth_timeout_s !== 'number') {
        throw new Error((s as any)?.error || 'tts settings unavailable');
      }
      setTtsTuning({
        synth_timeout_s: typeof s.synth_timeout_s === 'number' ? s.synth_timeout_s : TTS_TUNING_DEFAULTS.synth_timeout_s,
        edge_cooldown_s: typeof s.edge_cooldown_s === 'number' ? s.edge_cooldown_s : TTS_TUNING_DEFAULTS.edge_cooldown_s,
      });
      setTtsAvailable(true);
    } catch {
      setTtsAvailable(false);
    }
  }, []);

  const saveTtsTuning = useCallback(async () => {
    setTtsSaving(true);
    setTtsNotice(null);
    try {
      const r = await pycoreApi.setTtsSettings({
        synth_timeout_s: ttsTuning.synth_timeout_s,
        edge_cooldown_s: ttsTuning.edge_cooldown_s,
      });
      if (!r || (r as any).success === false || typeof r.synth_timeout_s !== 'number') {
        throw new Error((r as any)?.error || 'save rejected');
      }
      // Reflect the backend-clamped values.
      setTtsTuning({
        synth_timeout_s: typeof r.synth_timeout_s === 'number' ? r.synth_timeout_s : ttsTuning.synth_timeout_s,
        edge_cooldown_s: typeof r.edge_cooldown_s === 'number' ? r.edge_cooldown_s : ttsTuning.edge_cooldown_s,
      });
      setTtsNotice({ ok: true, text: 'TTS settings saved.' });
    } catch (e: any) {
      setTtsNotice({ ok: false, text: `Save failed: ${e?.message || 'pycore unreachable'}` });
    } finally {
      setTtsSaving(false);
    }
  }, [ttsTuning]);

  // --- Task capability chains (translation + voice fallback) --------------- #
  const [taskChains, setTaskChains] = useState<{ translation: string; voice_tts: string }>({
    translation: 'google, ecdict, wordnet, ai',
    voice_tts: 'gptsovits, streamelements, sherpa, melotts, edge, gtts_web, azure, chattts, cosyvoice, fishspeech, qwen3tts, bark, voxcpm2, kokoro, f5tts',
  });
  const [chainsSaving, setChainsSaving] = useState<string | null>(null);
  const [chainsNotice, setChainsNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadTaskChains = useCallback(async () => {
    try {
      const r = await pycoreApi.getTaskCapabilityChains();
      const c = r?.chains;
      if (!c) return;
      setTaskChains({
        translation: (c.translation ?? []).join(', '),
        voice_tts: (c.voice_tts ?? []).join(', '),
      });
    } catch { /* offline */ }
  }, []);

  const saveTaskChain = useCallback(async (taskType: 'translation' | 'voice_tts') => {
    setChainsSaving(taskType);
    setChainsNotice(null);
    const raw = taskChains[taskType] || '';
    const priority = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    try {
      const r = await pycoreApi.saveTaskCapabilityChain(taskType, priority);
      if (!r?.success) throw new Error((r as any)?.error || 'save rejected');
      if (r.chains) {
        setTaskChains({
          translation: (r.chains.translation ?? []).join(', '),
          voice_tts: (r.chains.voice_tts ?? []).join(', '),
        });
      }
      setChainsNotice({ ok: true, text: 'Task chain saved.' });
    } catch (e: any) {
      setChainsNotice({ ok: false, text: `Save failed: ${e?.message || 'pycore unreachable'}` });
    } finally {
      setChainsSaving(null);
    }
  }, [taskChains]);

  useEffect(() => {
    loadSettings();
    loadTtsTuning();
    loadTaskChains();
    pycoreApi.getAutostart().then((s) => {
      if (!isAutostart(s)) return;
      setAutostart(s);
      if (s.target) setAutostartTarget(s.target);
    }).catch(() => { /* offline */ });
  }, [loadSettings, loadTtsTuning, loadTaskChains]);

  // Persist a settings patch to the backend (optimistic update).
  const patch = useCallback(async (next: Partial<SystemSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      const r = await pycoreApi.setSystemSettings(merged as unknown as Record<string, unknown>);
      if (r?.success === false) { setNotice(r?.error || 'Failed to save settings'); return; }
      setUnreachable(false);
      setNotice('Saved');
    } catch {
      setUnreachable(true);
      setNotice('Could not reach pycore — change not saved.');
    }
  }, [settings]);

  // --- auto-start on boot ------------------------------------------------- #
  const toggleAutostart = async (enabled: boolean, target?: AutostartTarget) => {
    const useTarget = target ?? autostartTarget;
    setAutostartBusy(true);
    try {
      const r = await pycoreApi.setAutostart(enabled, enabled ? useTarget : undefined);
      const s = await pycoreApi.getAutostart();
      if (isAutostart(s)) {
        setAutostart(s);
        if (s.target) setAutostartTarget(s.target);
      }
      if (r?.success === false) setNotice(r.message || 'Failed to update auto-start');
      else setNotice(enabled ? `Auto-start enabled (${useTarget})` : 'Auto-start disabled');
    } catch (e: any) {
      setNotice('Request failed: ' + (e?.message || 'pycore unreachable'));
    } finally { setAutostartBusy(false); }
  };

  // Pick what boots. If auto-start is already on, re-apply immediately so the
  // generated entry reflects the new target; otherwise just remember the choice.
  const selectAutostartTarget = (target: AutostartTarget) => {
    setAutostartTarget(target);
    if (autostart?.enabled) toggleAutostart(true, target);
  };

  const toggle = (on: boolean, busy = false, onClick?: () => void) => (
    <button role="switch" aria-checked={on} disabled={busy} onClick={onClick}
      className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${
        on ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
      {busy ? (
        <RefreshCw className="w-3 h-3 animate-spin text-white absolute top-1.5 left-1.5" />
      ) : (
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      )}
    </button>
  );

  const row = (
    icon: React.ReactNode, title: string, desc: string,
    control: React.ReactNode, accent: string,
  ) => (
    <div className="flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${accent}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">{title}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      </div>
      {control}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Settings2 className="w-5 h-5 text-sky-500" /> Pycore Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Backend behaviors persisted on the pycore service.
          </p>
        </div>
        <button onClick={loadSettings} disabled={loading}
          className="p-2 rounded-xl pc-glass hover:bg-sky-500/10 text-sky-500 transition disabled:opacity-50 self-start" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* appearance/language note (those live in the shell controls) */}
      <div className="flex items-start gap-2 text-[11px] rounded-2xl p-3 border bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Appearance, dark mode and language are managed by the shell controls.</span>
      </div>

      {unreachable && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">pycore unreachable — the backend (:59000) may be offline. Changes won't be saved.</span>
        </div>
      )}

      {/* pycore reachability + offline recheck interval (frontend-local) */}
      <section className="pc-glass p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">Connection</h2>

        {row(
          <Wifi className="w-5 h-5" />, 'Pycore backend',
          pcHealth.up === null
            ? (pcHealth.reachability === 'probing' ? 'Probing HTTP…' : 'Not checked yet.')
            : pcHealth.up
              ? `Online — ping answered in ${pcHealth.responseTime}ms.`
              : 'Offline — retrying at the interval below until it answers.',
          <button onClick={recheckConnection} disabled={pcChecking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold pc-glass hover:bg-sky-500/10 text-sky-500 transition disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${pcChecking ? 'animate-spin' : ''}`} />
            Re-check
          </button>,
          pcHealth.up
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : pcHealth.up === false
              ? 'bg-red-500/10 text-red-500'
              : 'bg-slate-500/10 text-slate-400',
        )}

        <div className="flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Offline recheck interval</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Re-ping cadence while pycore is offline; stops once it answers. Stored in this browser.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input type="number" min={5} step={5}
              value={recheckSec}
              onChange={(e) => setRecheckSec(Number(e.target.value))}
              onBlur={commitRecheckInterval}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRecheckInterval(); }}
              className="w-20 px-2 py-1.5 text-xs text-right rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">s</span>
          </div>
        </div>

        {/* Laravel endpoint — same control as the global top bar; shared via
            PcLaravelEndpointContext (sync engine + Assist Laravel below). */}
        <div className="rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
          <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 mb-0.5">Laravel endpoint</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Which Laravel backend pycore targets (sync engine + Assist Laravel below). Also shown in the top bar on every page.
          </p>
          <PcLaravelEndpointSwitcher variant="embedded" />
        </div>
      </section>


      {/* Per-task-type capability fallback chains */}
      <section className="pc-glass p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Task capability chains</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Fallback order per task type (comma-separated). Voice chain also updates the shared TTS engine priority.
        </p>
        {(['translation', 'voice_tts'] as const).map((key) => (
          <div key={key} className="rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">
              {key === 'translation' ? 'Translation' : 'Voice (words + sentences)'}
            </div>
            <input
              value={taskChains[key]}
              onChange={(e) => setTaskChains((c) => ({ ...c, [key]: e.target.value }))}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200"
              placeholder={key === 'translation' ? 'google, ecdict, wordnet, ai' : 'chattts, cosyvoice, fishspeech, qwen3tts, bark, parler, …'}
            />
            <button
              type="button"
              onClick={() => saveTaskChain(key)}
              disabled={chainsSaving === key}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 disabled:opacity-50 flex items-center gap-1.5">
              {chainsSaving === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save chain
            </button>
          </div>
        ))}
        {chainsNotice && (
          <span className={`text-[11px] ${chainsNotice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
            {chainsNotice.text}
          </span>
        )}
      </section>

      {/* TTS tuning: edge-tts per-attempt synth timeout + failure cooldown.
          Loaded/saved via pycoreApi.get/setTtsSettings (backend clamps the
          values). Degrades to a muted "unavailable" notice when pycore is off. */}
      <section className="pc-glass p-6 space-y-3">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider">TTS tuning</h2>
          <button onClick={loadTtsTuning} disabled={ttsAvailable === null}
            className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50" title="Reload TTS settings">
            <RefreshCw className={`w-3.5 h-3.5 ${ttsAvailable === null ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {ttsAvailable === false && (
          <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">
              TTS settings unavailable — the pycore backend may be offline or not deployed with TTS tuning support yet.
            </span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${ttsAvailable === true ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Edge synth timeout (s)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                How long one edge-tts attempt may run before failing fast to the offline engine.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input type="number" min={5} max={120} step={1}
                value={ttsTuning.synth_timeout_s}
                disabled={ttsAvailable !== true}
                onChange={(e) => setTtsTuning((s) => ({ ...s, synth_timeout_s: Number(e.target.value) }))}
                className="w-20 px-2 py-1.5 text-xs text-right rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:opacity-50" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">s</span>
            </div>
          </div>
          <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${ttsAvailable === true ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Edge failure cooldown (s)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                How long to skip edge-tts after it fails, falling back to the offline engine.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input type="number" min={0} max={3600} step={5}
                value={ttsTuning.edge_cooldown_s}
                disabled={ttsAvailable !== true}
                onChange={(e) => setTtsTuning((s) => ({ ...s, edge_cooldown_s: Number(e.target.value) }))}
                className="w-20 px-2 py-1.5 text-xs text-right rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:opacity-50" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveTtsTuning} disabled={ttsAvailable !== true || ttsSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5">
            {ttsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save TTS settings
          </button>
          {ttsNotice && (
            <span className={`text-[11px] ${ttsNotice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
              {ttsNotice.text}
            </span>
          )}
        </div>
      </section>

      {/* backend system settings */}
      <section className="pc-glass p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">System</h2>

        {row(
          <Clipboard className="w-5 h-5" />, 'Monitor clipboard',
          'Watch the system clipboard and route captured content into pycore.',
          toggle(settings.monitorClipboard, false, () => patch({ monitorClipboard: !settings.monitorClipboard })),
          'bg-purple-500/10 text-purple-600 dark:text-purple-400',
        )}

        {row(
          <ImageIcon className="w-5 h-5" />, 'Scheduled screenshot',
          'Periodically capture a screenshot for processing.',
          toggle(settings.scheduledScreenshot, false, () => patch({ scheduledScreenshot: !settings.scheduledScreenshot })),
          'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
        )}

        {/* screenshot interval (only relevant when scheduled is on) */}
        <div className={`rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${settings.scheduledScreenshot ? '' : 'opacity-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Screenshot interval</span>
            <span className="text-xs font-mono font-bold text-indigo-500">{settings.screenshotInterval}s</span>
          </div>
          <input type="range" min={5} max={600} step={5}
            value={settings.screenshotInterval}
            disabled={!settings.scheduledScreenshot}
            onChange={(e) => setSettings((s) => ({ ...s, screenshotInterval: parseInt(e.target.value) }))}
            onMouseUp={() => patch({ screenshotInterval: settings.screenshotInterval })}
            onTouchEnd={() => patch({ screenshotInterval: settings.screenshotInterval })}
            className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed" />
        </div>

        {row(
          <FileText className="w-5 h-5" />, 'NotebookLM auto-convert',
          'Automatically convert captured documents for NotebookLM.',
          toggle(settings.notebooklmAutoConvert, false, () => patch({ notebooklmAutoConvert: !settings.notebooklmAutoConvert })),
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
      </section>

      {/* auto-start on boot */}
      <section className="pc-glass p-6">
        <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Startup</h2>
        <div className="flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500 mt-0.5 shrink-0"><Power className="w-5 h-5" /></div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Start on boot</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {autostart && autostart.supported === false
                  ? 'Auto-start is not supported on this platform.'
                  : 'Launch the pycore service automatically when this machine starts.'}
              </p>
              {autostart?.location && (
                <p className="text-[10px] font-mono text-slate-400 mt-1 break-all">
                  {autostart.scope === 'current-user' ? 'User' : 'System'}: {autostart.location}
                </p>
              )}
            </div>
          </div>
          {toggle(!!autostart?.enabled, autostartBusy || autostart?.supported === false,
            () => toggleAutostart(!autostart?.enabled))}
        </div>

        {/* what to launch at boot */}
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">What to launch</div>
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
            {(autostart?.targets ?? (['pyservice', 'launcher', 'both'] as AutostartTarget[])).map((t) => {
              const labels: Record<string, string> = { pyservice: 'Pyservice', launcher: 'Terminal launcher', both: 'Both' };
              const active = autostartTarget === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={autostartBusy || autostart?.supported === false}
                  onClick={() => selectAutostartTarget(t)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active
                    ? 'bg-sky-500 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10'}`}
                >
                  {labels[t] ?? t}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Pyservice = HTTP + dashboard UI. Terminal launcher arranges terminals across the display (needs a graphical session). Both runs the launcher, then pyservice.
            {autostart?.mechanism ? ` · mechanism: ${autostart.mechanism}` : ''}
          </p>
        </div>
      </section>

      {notice && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
      )}
    </div>
  );
};

export default PcSettingsPage;
