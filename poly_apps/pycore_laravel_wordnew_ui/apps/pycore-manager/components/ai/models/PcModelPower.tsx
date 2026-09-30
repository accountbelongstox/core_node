/**
 * PcModelPower — enable toggle and start / stop for one managed server model.
 * Shown when the manifest marks the entry `capabilities.power`; the routes are the
 * existing managed-server controllers of the entry's category.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { pycoreApi, refreshAiHubCatalog } from '@/apps/pycore-manager/api';
import type { AiHubEntry } from '@/apps/pycore-manager/api';

interface PowerPatch {
  enabled?: boolean;
  start?: boolean;
}

const POWER_ACTIONS: Record<string, (id: string, patch: PowerPatch) => Promise<unknown>> = {
  tts: (id, patch) => pycoreApi.postTtsServer({ engine: id, ...patch }),
  llm: (id, patch) => pycoreApi.controlLlmServer({ engine: id, ...patch }),
};

export function pcModelSupportsPower(entry: AiHubEntry): boolean {
  return !!entry.capabilities.power && entry.category in POWER_ACTIONS;
}

export const PcModelPower: React.FC<{ entry: AiHubEntry }> = ({ entry }) => {
  const { t } = useTranslation('pc');
  const [busy, setBusy] = useState(false);
  const act = POWER_ACTIONS[entry.category];
  const enabled = entry.runtime_state.enabled !== false;
  const running = !!entry.runtime_state.running;

  const apply = useCallback(async (patch: PowerPatch) => {
    if (!act) return;
    setBusy(true);
    try {
      await act(entry.id, patch);
    } finally {
      await refreshAiHubCatalog();
      setBusy(false);
    }
  }, [act, entry.id]);

  if (!act || !entry.capabilities.power) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300/40 dark:border-white/10 bg-white/50 dark:bg-white/5 text-[10px]">
      <label className="inline-flex items-center gap-1 cursor-pointer text-slate-500">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => { void apply({ enabled: event.target.checked, start: event.target.checked }); }}
          className="rounded border-slate-300 scale-90"
        />
        {t('aiHub.power.enable')}
      </label>
      <button
        type="button"
        disabled={busy || !enabled}
        onClick={() => { void apply({ start: !running }); }}
        className="p-0.5 rounded hover:bg-indigo-500/10 text-indigo-500 disabled:opacity-40"
        title={running ? t('aiHub.power.stop') : t('aiHub.power.start')}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : running ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
      </button>
    </div>
  );
};
