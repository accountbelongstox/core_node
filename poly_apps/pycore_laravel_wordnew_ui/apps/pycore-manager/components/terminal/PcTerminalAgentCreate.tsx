/**
 * New virtual agent window (claudeteam, codexyolo, deepseek, agyyolo): an AI CLI conversation that needs no
 * desktop window. Each message runs the CLI headless in the background and resumes the stored conversation id.
 */
import React, { useCallback, useState } from 'react';
import { Bot, Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TerminalAgentKind, TerminalAgentKindInfo } from '@/apps/pycore-manager/api';
import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { PcTerminalLauncherNotice } from '@/apps/pycore-manager/components/terminal/PcTerminalLauncherBar';

interface PcTerminalAgentCreateProps {
  kinds: TerminalAgentKindInfo[];
  errorTranslationKey: (errorCode?: string | null) => string;
  onNotice: (notice: PcTerminalLauncherNotice) => void;
  onDone: () => void;
}

export const PcTerminalAgentCreate: React.FC<PcTerminalAgentCreateProps> = ({ kinds, errorTranslationKey, onNotice, onDone }) => {
  const { t } = useTranslation('pc');
  const terminalApi = usePcTerminalApi();
  const [kind, setKind] = useState<TerminalAgentKind | ''>('');
  const [busy, setBusy] = useState(false);
  const selected = kinds.find((info) => info.kind === kind) ?? kinds.find((info) => info.available) ?? kinds[0];

  const create = useCallback(async () => {
    if (busy || !selected) return;
    setBusy(true);
    try {
      const result = await terminalApi.createTerminalAgent(selected.kind);
      onNotice(result.success
        ? { kind: 'success', translationKey: 'terminal.agents.created', translationValues: { kind: selected.kind } }
        : { kind: 'error', translationKey: errorTranslationKey(result.error_code) });
    } catch {
      onNotice({ kind: 'error', translationKey: 'terminal.errors.request' });
    } finally {
      setBusy(false);
      onDone();
    }
  }, [busy, errorTranslationKey, onDone, onNotice, selected, terminalApi]);

  if (!kinds.length) return null;

  return (
    <div className="flex min-w-0 items-center gap-1" aria-label={t('terminal.agents.title')}>
      <Bot className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
      <select
        value={selected?.kind ?? ''}
        onChange={(event) => setKind(event.target.value as TerminalAgentKind)}
        disabled={busy}
        title={t('terminal.agents.hint')}
        aria-label={t('terminal.agents.kind')}
        className="w-0 min-w-[4.5rem] max-w-[8rem] flex-1 truncate rounded-md border border-slate-500/20 bg-transparent px-0.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
      >
        {kinds.map((info) => (
          <option key={info.kind} value={info.kind}>
            {info.available ? info.kind : t('terminal.agents.missing', { kind: info.kind, binary: info.binary })}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || !selected?.available}
        title={`${t('terminal.agents.create')} · ${t('terminal.agents.hint')}`}
        aria-label={t('terminal.agents.create')}
        className="inline-flex shrink-0 items-center rounded-md bg-emerald-500/10 p-1 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </button>
    </div>
  );
};
