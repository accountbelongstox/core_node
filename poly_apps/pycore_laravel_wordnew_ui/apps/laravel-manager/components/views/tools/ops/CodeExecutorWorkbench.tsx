/** Code Executor: the server's predefined scripts as a runnable list with a terminal-style output console. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Play, Terminal } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { callToolApi, useToolRun } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, Console, CopyBtn, EmptyBlock, Notice, OpsPage, OpsStatusBar, Panel, Spinner } from './opsKit';
import { useRemote } from './opsHooks';
import { formatSeconds } from './opsLogic';
import type { ScriptRow, ScriptRunData, ScriptsData } from './opsTypes';

interface RunEntry extends ScriptRunData {
  key: number;
}

const ALL = '';
const EXECUTE_METHOD = 'serverManagerV1.executeScript';
const HISTORY_LIMIT = 8;

const CodeExecutorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(ALL);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<RunEntry[]>([]);
  const [shownKey, setShownKey] = useState<number | null>(null);
  const scripts = useRemote(() => callToolApi<ScriptsData>(tool.apiMethod), []);
  const { error, running, run } = useToolRun<ScriptRunData>(tool.id, variant);
  const rows = scripts.data?.scripts ?? [];
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category))), [rows]);
  const visible = rows.filter((row) => !category || row.category === category);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const shown = history.find((entry) => entry.key === shownKey) ?? history[0] ?? null;

  const categoryLabel = (value: string): string => t(`toolsOps.executor.categories.${value}`, { defaultValue: value.replace(/_/g, ' ') });

  const execute = async (script: ScriptRow): Promise<void> => {
    if (running || script.requires_sudo || !window.confirm(t('toolsOps.executor.confirm_run', { name: script.name }))) return;
    const result = await run({ script_id: script.id, name: script.name }, () => callToolApi<ScriptRunData>(EXECUTE_METHOD, { script_id: script.id }));
    if (result) {
      const entry: RunEntry = { ...result, key: Date.now() };
      setHistory((entries) => [entry, ...entries].slice(0, HISTORY_LIMIT));
      setShownKey(entry.key);
    }
  };

  return (
    <OpsPage>
      <OpsStatusBar accent="teal" mode="server" updatedAt={scripts.updatedAt} loading={scripts.loading} onRefresh={() => void scripts.reload()}>
        {running ? t('toolsOps.executor.running', { name: selected?.name ?? '' }) : t('toolsOps.executor.status', { count: rows.length })}
      </OpsStatusBar>
      {scripts.error && <Notice tone="error">{scripts.error}</Notice>}
      <Notice tone="info">{t('toolsOps.executor.safety_note')}</Notice>

      {categories.length > 1 && (
        <Chips accent="teal" value={category} onChange={setCategory} nowrap options={[{ value: ALL, label: t('toolsOps.nginx.filter_all') }, ...categories.map((value) => ({ value, label: categoryLabel(value) }))]} />
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title={t('toolsOps.executor.scripts')} icon={Terminal} accent="teal" className="lg:col-span-2" bodyClassName="p-0">
          {visible.length === 0 ? (
            <EmptyBlock icon={Terminal}>{scripts.loading ? t('toolsOps.common.loading') : t('toolsOps.executor.empty')}</EmptyBlock>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/50">
              {visible.map((script) => (
                <li key={script.id}>
                  <button type="button" onClick={() => setSelectedId(script.id)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${script.id === selectedId ? 'bg-teal-50 dark:bg-teal-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                    <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-400">{script.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{script.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{script.description}</span>
                    </span>
                    {script.requires_sudo ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-label={t('toolsOps.executor.needs_sudo')} /> : <Pill>{categoryLabel(script.category)}</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4 lg:col-span-3">
          {selected ? (
            <Panel
              title={selected.name}
              icon={Terminal}
              accent="teal"
              actions={<Btn size="sm" variant="primary" accent="teal" icon={Play} loading={running} onClick={() => void execute(selected)} disabled={selected.requires_sudo}>{t('toolsOps.executor.run')}</Btn>}
            >
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{selected.description}</p>
              <Console className="max-h-32">{`$ ${selected.command}`}</Console>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill>{t('toolsOps.executor.timeout', { seconds: selected.timeout })}</Pill>
                <Pill tone={selected.requires_sudo ? 'amber' : 'emerald'} tint>{selected.requires_sudo ? t('toolsOps.executor.needs_sudo') : t('toolsOps.executor.runnable')}</Pill>
              </div>
              {selected.requires_sudo && <Notice tone="warn" className="mt-3">{t('toolsOps.executor.sudo_blocked')}</Notice>}
            </Panel>
          ) : (
            <Panel bodyClassName="p-0"><EmptyBlock icon={Terminal}>{t('toolsOps.executor.pick')}</EmptyBlock></Panel>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          {running && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner />{t('toolsOps.executor.running', { name: selected?.name ?? '' })}</div>}

          {shown && (
            <Panel
              title={t('toolsOps.executor.output')}
              icon={Terminal}
              accent="teal"
              actions={<CopyBtn text={`${shown.output}${shown.error_output ? `\n${shown.error_output}` : ''}`} accent="teal" />}
            >
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Pill tone={shown.success ? 'emerald' : 'rose'} tint>{t('toolsOps.executor.exit_code', { code: shown.exit_code })}</Pill>
                <Pill>{formatSeconds(shown.execution_time)}</Pill>
                {shown.timeout_reached && <Pill tone="amber" tint>{t('toolsOps.executor.timed_out')}</Pill>}
                <span className="text-[11px] text-slate-400">{shown.script_name} · {shown.completed_at}</span>
              </div>
              <Console>{shown.output || t('toolsOps.nginx.no_output')}</Console>
              {shown.error_output && <Console tone="err" className="mt-2">{shown.error_output}</Console>}
              {history.length > 1 && (
                <div className="mt-3">
                  <Chips accent="teal" value={shown.key} onChange={setShownKey} options={history.map((entry) => ({ value: entry.key, label: `${entry.script_name} · ${entry.completed_at.slice(11)}` }))} nowrap />
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </OpsPage>
  );
};

export default CodeExecutorWorkbench;
