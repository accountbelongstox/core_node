/**
 * Managed local TTS HTTP server controls (enable / start / stop + global options).
 *
 * Surfaces class-C (isolated HTTP server) TTS engines ONLY. The controlled list is
 * DERIVED from engines flagged `server_engine` (qwen3tts included) so any future
 * server gains controls automatically; the hardcoded list below is only a fallback
 * for older backends that omit the flag. Presentational + settings passthrough —
 * the lifecycle rules themselves are NOT restated here.
 * Ref: apps/pycore-manager/docs/TTS_STT_ENGINE_LIFECYCLE.md §2 and the canonical
 * development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { TtsEngine, TtsSettings } from '@/apps/pycore-manager/api';

// Fallback class-C (isolated HTTP server) engine names for backends that omit the
// `server_engine` flag. Mirrors the dev-spec §1 class-C set so melotts/gptsovits/qwen3tts
// still get server controls even before the backend reports the flag — never model-only.
const FALLBACK_SERVER_ENGINES = ['chattts', 'cosyvoice', 'fishspeech', 'gptsovits', 'f5tts', 'qwen3tts', 'melotts'] as const;

type Props = {
  engines: TtsEngine[];
  onChanged: () => void;
};

export const PcTtsServerControls: React.FC<Props> = ({ engines, onChanged }) => {
  const { t } = useTranslation('pc');
  const [settings, setSettings] = useState<TtsSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await pycoreApi.getTtsSettings();
      if (s?.success !== false) setSettings(s);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (patch: Partial<TtsSettings>) => {
    setBusy('settings');
    try {
      const r = await pycoreApi.setTtsSettings(patch);
      if (r?.success !== false) setSettings(r);
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (engine: string, on: boolean) => {
    setBusy(engine);
    try {
      await pycoreApi.postTtsServer({ engine, enabled: on, start: on });
      await load();
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const toggleRunning = async (engine: string, start: boolean) => {
    setBusy(`${engine}-run`);
    try {
      await pycoreApi.postTtsServer({ engine, start });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const serverRows = engines.filter((e) => e.server_engine || FALLBACK_SERVER_ENGINES.includes(e.name as typeof FALLBACK_SERVER_ENGINES[number]));
  if (serverRows.length === 0 && !settings) return null;

  const enabledMap = settings?.server_enabled ?? {};
  const single = settings?.server_single_active !== false;
  const idle = settings?.server_idle_shutdown_s ?? 180;

  return (
    <div className="mb-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
        <span className="font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
          {t('pipeline.ttsServerTitle')}
        </span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.server_auto_manage !== false}
            disabled={busy === 'settings'}
            onChange={(ev) => { void saveSettings({ server_auto_manage: ev.target.checked }); }}
            className="rounded border-slate-300"
          />
          {t('pipeline.ttsServerAuto')}
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer" title={t('pipeline.ttsServerSingleHint')}>
          <input
            type="checkbox"
            checked={single}
            disabled={busy === 'settings'}
            onChange={(ev) => { void saveSettings({ server_single_active: ev.target.checked }); }}
            className="rounded border-slate-300"
          />
          {t('pipeline.ttsServerSingle')}
        </label>
        <label className="inline-flex items-center gap-1">
          {t('pipeline.ttsServerIdle')}
          <input
            type="number"
            min={0}
            max={600}
            value={idle}
            disabled={busy === 'settings'}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              if (!Number.isNaN(v)) void saveSettings({ server_idle_shutdown_s: v });
            }}
            className="w-12 px-1 py-0.5 rounded border border-slate-300/50 bg-white/60 dark:bg-white/5 text-[10px] font-mono"
          />
          s
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {serverRows.map((row: TtsEngine) => {
          const name = row.name;
          const installed = row.installed;
          const running = row.server_running;
          const managed = row.server_managed;
          const en = enabledMap[name] !== false;
          const isBusy = busy === name || busy === `${name}-run`;
          if (!installed) return null;
          return (
            <div
              key={name}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300/40 dark:border-white/10 bg-white/50 dark:bg-white/5 text-[10px]"
              title={row?.disabled_reason || name}>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{name}</span>
              <label className="inline-flex items-center gap-1 cursor-pointer text-slate-500">
                <input
                  type="checkbox"
                  checked={en}
                  disabled={isBusy}
                  onChange={(ev) => { void toggleEnabled(name, ev.target.checked); }}
                  className="rounded border-slate-300 scale-90"
                />
                {t('pipeline.ttsServerEnable')}
              </label>
              <span className={`px-1 rounded text-[9px] font-bold uppercase ${
                running ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-500/10 text-slate-400'}`}>
                {running ? (managed ? t('pipeline.ttsServerManaged') : t('pipeline.ttsServerUp')) : t('pipeline.ttsServerDown')}
              </span>
              {typeof row?.server_idle_remaining_s === 'number' && managed && (
                <span className="font-mono text-amber-600">{Math.ceil(row.server_idle_remaining_s)}s</span>
              )}
              <button
                type="button"
                disabled={isBusy || !en}
                onClick={() => { void toggleRunning(name, !running); }}
                className="p-0.5 rounded hover:bg-indigo-500/10 text-indigo-500 disabled:opacity-40"
                title={running ? t('pipeline.ttsServerStop') : t('pipeline.ttsServerStart')}>
                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" />
                  : running ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PcTtsServerControls;
