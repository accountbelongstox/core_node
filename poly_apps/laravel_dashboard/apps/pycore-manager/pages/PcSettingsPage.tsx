/**
 * PcSettingsPage — pycore BACKEND settings only.
 *
 * The shell owns global theme, dark mode and language, so this page drops the
 * appearance/accent/glass/language UI and keeps only backend-persisted settings:
 * system-settings (pycoreApi.getSystemSettings/setSystemSettings —
 * monitorClipboard, scheduledScreenshot, screenshotInterval, notebooklmAutoConvert),
 * the Laravel endpoint selection (PcLaravelEndpointSwitcher — pycore-owned
 * `laravel_api.*` RPCs), the Assist Laravel worker config
 * (pycoreApi.getAssistStatus/setAssistConfig — pycore drains Laravel's
 * cover/tts/translation queues against the SELECTED endpoint above) and
 * auto-start on boot (pycoreApi.getAutostart/setAutostart). Every backend call
 * is guarded; an inline "pycore unreachable" state is shown when the backend
 * (:59000) is offline. Local React state, pycoreApi, lucide-react and
 * Tailwind / `.pc-glass` only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings2, Power, RefreshCw, Clipboard, Image as ImageIcon, FileText,
  AlertTriangle, Info, Wifi, Handshake, Server, Languages, Volume2, Save, Loader2,
} from 'lucide-react';
import {
  pycoreApi,
  PYCORE_HEALTH_EVENT, getPycoreHealth, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
} from '../../../core/api-libs/pycore';
import type {
  AutostartStatus, PycoreHealthState, AssistCapabilities, AssistStatus,
} from '../../../core/api-libs/pycore';
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

// --- Assist Laravel (pycore drains Laravel's cover/tts/translation queues) - #
interface AssistForm {
  enabled: boolean;
  capabilities: AssistCapabilities;
  poll_interval_s: number;
  batch_limit: number;
  // Live worker loop state (status-only, never sent in the config payload).
  running: boolean;
}

const ASSIST_DEFAULTS: AssistForm = {
  enabled: false,
  capabilities: { cover: true, tts: true, translation: true },
  poll_interval_s: 30,
  batch_limit: 5,
  running: false,
};

/** Loose 404/error bodies must not populate the form — shape-guard the reply. */
const isAssistStatus = (s: any): s is AssistStatus =>
  !!s && typeof s.enabled === 'boolean' && !!s.capabilities;

const ASSIST_CAPS: { key: keyof AssistCapabilities; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'cover', label: 'Cover images', Icon: ImageIcon },
  { key: 'tts', label: 'TTS audio', Icon: Volume2 },
  { key: 'translation', label: 'Word translation', Icon: Languages },
];

const PcSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [autostart, setAutostart] = useState<AutostartStatus | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);

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

  // --- Assist Laravel ------------------------------------------------------ #
  const [assist, setAssist] = useState<AssistForm>(ASSIST_DEFAULTS);
  // null = loading, false = endpoint missing / pycore offline, true = loaded.
  const [assistAvailable, setAssistAvailable] = useState<boolean | null>(null);
  const [assistEndpoint, setAssistEndpoint] = useState<{ base_url: string; label?: string } | null>(null);
  const [assistSaving, setAssistSaving] = useState(false);
  const [assistNotice, setAssistNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAssist = useCallback(async () => {
    setAssistAvailable(null);
    try {
      const s = await pycoreApi.getAssistStatus();
      if (!isAssistStatus(s)) throw new Error((s as any)?.error || (s as any)?.detail || 'assist status unavailable');
      setAssist({
        enabled: s.enabled === true,
        capabilities: {
          cover: s.capabilities?.cover !== false,
          tts: s.capabilities?.tts !== false,
          translation: s.capabilities?.translation !== false,
        },
        poll_interval_s: typeof s.poll_interval_s === 'number' ? s.poll_interval_s : ASSIST_DEFAULTS.poll_interval_s,
        batch_limit: typeof s.batch_limit === 'number' ? s.batch_limit : ASSIST_DEFAULTS.batch_limit,
        running: s.running === true,
      });
      setAssistEndpoint(s.endpoint ?? null);
      setAssistAvailable(true);
    } catch {
      setAssistAvailable(false);
    }
  }, []);

  const saveAssist = useCallback(async () => {
    setAssistSaving(true);
    setAssistNotice(null);
    try {
      const r = await pycoreApi.setAssistConfig({
        enabled: assist.enabled,
        capabilities: assist.capabilities,
        poll_interval_s: Math.max(5, Math.round(assist.poll_interval_s) || ASSIST_DEFAULTS.poll_interval_s),
        batch_limit: Math.max(1, Math.round(assist.batch_limit) || ASSIST_DEFAULTS.batch_limit),
      });
      if (!r || r.ok !== true) throw new Error((r as any)?.error || (r as any)?.detail || 'save rejected');
      // Reflect what the backend actually applied (clamping etc.). The config
      // response carries no live `running` flag — keep the last status value and
      // let the next loadAssist() refresh it.
      if (r.config) {
        setAssist((prev) => ({
          enabled: r.config.enabled === true,
          capabilities: {
            cover: r.config.capabilities?.cover !== false,
            tts: r.config.capabilities?.tts !== false,
            translation: r.config.capabilities?.translation !== false,
          },
          poll_interval_s: typeof r.config.poll_interval_s === 'number' ? r.config.poll_interval_s : prev.poll_interval_s,
          batch_limit: typeof r.config.batch_limit === 'number' ? r.config.batch_limit : prev.batch_limit,
          running: prev.running,
        }));
      }
      setAssistNotice({ ok: true, text: 'Assist settings saved.' });
    } catch (e: any) {
      setAssistNotice({ ok: false, text: `Save failed: ${e?.message || 'pycore unreachable'}` });
    } finally {
      setAssistSaving(false);
    }
  }, [assist]);

  useEffect(() => {
    loadSettings();
    loadAssist();
    pycoreApi.getAutostart().then(setAutostart).catch(() => { /* offline */ });
  }, [loadSettings, loadAssist]);

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
  const toggleAutostart = async (enabled: boolean) => {
    setAutostartBusy(true);
    try {
      const r = await pycoreApi.setAutostart(enabled);
      const s = await pycoreApi.getAutostart();
      setAutostart(s);
      if (r?.success === false) setNotice(r.message || 'Failed to update auto-start');
      else setNotice(enabled ? 'Auto-start enabled' : 'Auto-start disabled');
    } catch (e: any) {
      setNotice('Request failed: ' + (e?.message || 'pycore unreachable'));
    } finally { setAutostartBusy(false); }
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
            ? 'Not checked yet.'
            : pcHealth.up
              ? `Online — /pyapi/ping answered in ${pcHealth.responseTime}ms.`
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

      {/* Assist Laravel: pycore claims cover/tts/translation work from the
          SELECTED Laravel endpoint above and submits the results back. */}
      <section className="pc-glass p-6 space-y-3">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h2 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Assist Laravel</h2>
          <button onClick={loadAssist} disabled={assistAvailable === null}
            className="p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50" title="Reload assist config">
            <RefreshCw className={`w-3.5 h-3.5 ${assistAvailable === null ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {assistAvailable === false && (
          <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">
              Assist endpoints unavailable — the pycore backend may be offline or not deployed with assist support yet.
            </span>
          </div>
        )}

        {row(
          <Handshake className="w-5 h-5" />, 'Assist Laravel queues',
          'Pycore periodically claims cover / TTS / translation work from the selected Laravel backend, processes it locally and submits the results.',
          <div className="flex items-center gap-3 shrink-0">
            {assistAvailable === true && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                assist.running
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-500/15 text-slate-400'}`}
                title={assist.running
                  ? 'The assist worker loop is currently running.'
                  : 'The assist worker loop is stopped.'}>
                <span className={`w-1.5 h-1.5 rounded-full ${assist.running ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {assist.running ? 'Running' : 'Stopped'}
              </span>
            )}
            {toggle(assist.enabled, assistAvailable !== true,
              () => setAssist((a) => ({ ...a, enabled: !a.enabled })))}
          </div>,
          'bg-rose-500/10 text-rose-500',
        )}

        {/* capabilities — meaningless without the master switch, so greyed/
            disabled while `enabled` is OFF. Ticking any capability ON also flips
            the master ON in the same update so the worker actually starts. */}
        <div className={`rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${assistAvailable === true && assist.enabled ? '' : 'opacity-50'}`}>
          <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 mb-0.5">Capabilities</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            {assistAvailable === true && !assist.enabled
              ? 'Enable Assist Laravel above to choose which kinds of work this pycore instance takes.'
              : 'Which kinds of Laravel work this pycore instance is allowed to take.'}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {ASSIST_CAPS.map(({ key, label, Icon }) => (
              <label key={key} className={`flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 select-none ${
                assistAvailable === true && assist.enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input type="checkbox"
                  checked={assist.capabilities[key]}
                  disabled={assistAvailable !== true || !assist.enabled}
                  onChange={() => setAssist((a) => {
                    const nextOn = !a.capabilities[key];
                    return {
                      ...a,
                      // Turning a capability ON implies the master must be ON too.
                      enabled: nextOn ? true : a.enabled,
                      capabilities: { ...a.capabilities, [key]: nextOn },
                    };
                  })}
                  className="w-3.5 h-3.5 accent-rose-500 disabled:cursor-not-allowed" />
                <Icon className="w-3.5 h-3.5 text-rose-400" />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* poll interval + batch limit */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${assistAvailable === true ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Poll interval</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">How often the worker asks Laravel for work.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input type="number" min={5} step={5}
                value={assist.poll_interval_s}
                disabled={assistAvailable !== true}
                onChange={(e) => setAssist((a) => ({ ...a, poll_interval_s: Number(e.target.value) }))}
                className="w-20 px-2 py-1.5 text-xs text-right rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:opacity-50" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">s</span>
            </div>
          </div>
          <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 ${assistAvailable === true ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Batch limit</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Max items claimed per cycle.</p>
            </div>
            <input type="number" min={1} step={1}
              value={assist.batch_limit}
              disabled={assistAvailable !== true}
              onChange={(e) => setAssist((a) => ({ ...a, batch_limit: Number(e.target.value) }))}
              className="w-20 px-2 py-1.5 text-xs text-right rounded-xl border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200 disabled:opacity-50 shrink-0" />
          </div>
        </div>

        {/* target endpoint (read-only — follows the Connection selection) */}
        <div className="rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 shrink-0">Target endpoint</span>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate"
              title={assistEndpoint?.base_url}>
              {assistEndpoint?.base_url ?? '— none selected —'}
            </span>
            {assistEndpoint?.label && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 font-bold shrink-0">
                {assistEndpoint.label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Read-only — assist follows the Laravel endpoint selected in Connection above.
          </p>
        </div>

        {/* save */}
        <div className="flex items-center gap-3">
          <button onClick={saveAssist} disabled={assistAvailable !== true || assistSaving}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition flex items-center gap-1.5">
            {assistSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save assist settings
          </button>
          {assistNotice && (
            <span className={`text-[11px] ${assistNotice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
              {assistNotice.text}
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
      </section>

      {notice && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
      )}
    </div>
  );
};

export default PcSettingsPage;
