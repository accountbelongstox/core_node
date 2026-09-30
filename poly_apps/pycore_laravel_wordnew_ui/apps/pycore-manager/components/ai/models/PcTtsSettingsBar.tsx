/**
 * PcTtsSettingsBar — global managed-TTS-server options (auto-start on use, one
 * server at a time, idle shutdown). Per-server enable / start / stop live on the
 * model rows (PcModelPower).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pycoreApi, refreshAiHubCatalog } from '@/apps/pycore-manager/api';
import type { TtsSettings } from '@/apps/pycore-manager/api';

const IDLE_SHUTDOWN_DEFAULT_S = 180;
const IDLE_SHUTDOWN_MAX_S = 600;

export const PcTtsSettingsBar: React.FC = () => {
  const { t } = useTranslation('pc');
  const [settings, setSettings] = useState<TtsSettings | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await pycoreApi.getTtsSettings();
      if (loaded?.success !== false) setSettings(loaded);
    } catch { /* keep the last settings */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Partial<TtsSettings>) => {
    setBusy(true);
    try {
      const saved = await pycoreApi.setTtsSettings(patch);
      if (saved?.success !== false) setSettings(saved);
      await refreshAiHubCatalog();
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-[10px] text-slate-500">
      <span className="font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{t('pipeline.ttsServerTitle')}</span>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.server_auto_manage !== false}
          disabled={busy}
          onChange={(event) => { void save({ server_auto_manage: event.target.checked }); }}
          className="rounded border-slate-300"
        />
        {t('pipeline.ttsServerAuto')}
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer" title={t('pipeline.ttsServerSingleHint')}>
        <input
          type="checkbox"
          checked={settings.server_single_active !== false}
          disabled={busy}
          onChange={(event) => { void save({ server_single_active: event.target.checked }); }}
          className="rounded border-slate-300"
        />
        {t('pipeline.ttsServerSingle')}
      </label>
      <label className="inline-flex items-center gap-1">
        {t('pipeline.ttsServerIdle')}
        <input
          type="number"
          min={0}
          max={IDLE_SHUTDOWN_MAX_S}
          value={settings.server_idle_shutdown_s ?? IDLE_SHUTDOWN_DEFAULT_S}
          disabled={busy}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isNaN(value)) void save({ server_idle_shutdown_s: value });
          }}
          className="w-14 px-1 py-0.5 rounded border border-slate-300/50 bg-white/60 dark:bg-white/5 text-[10px] font-mono"
        />
        {t('aiHub.power.seconds')}
      </label>
    </div>
  );
};
