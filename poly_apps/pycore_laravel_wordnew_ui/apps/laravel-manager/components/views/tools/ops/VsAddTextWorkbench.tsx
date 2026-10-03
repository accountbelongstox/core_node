/** Add Text to Queue: a composer that submits text to the voice-subtitle pipeline and follows its steps live. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardPaste, Circle, Eraser, Minus, Send, X } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { GLOBAL_TASK_TERMINAL_STATUSES } from '@/core/contracts/QueueCenterContract';
import { callToolApi, useToolRun } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, controlClass, Field, Notice, OpsPage, OpsStatusBar, Panel, Spinner } from './opsKit';
import { describeError, useMountedRef, useRemote } from './opsHooks';
import { pollUntil } from './opsLogic';
import type { VoiceAddData, VoiceGroupsData, VoiceLanguagesData, VoiceTask, VoiceTaskData } from './opsTypes';

interface ComposerInput {
  text: string;
  language: string;
  group: string;
}

const FALLBACK_LANGUAGE = 'en';
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 90;
const TEXT_MAX_CHARS = 20000;
const isTerminal = (status: string): boolean => (GLOBAL_TASK_TERMINAL_STATUSES as string[]).includes(status);

const StepIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'completed') return <Check className="h-4 w-4 text-emerald-500" />;
  if (status === 'running') return <Spinner className="h-4 w-4 text-lime-500" />;
  if (status === 'failed') return <X className="h-4 w-4 text-rose-500" />;
  if (status === 'skipped') return <Minus className="h-4 w-4 text-slate-300" />;
  return <Circle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />;
};

const VsAddTextWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const previous = lastRun?.input as Partial<ComposerInput> | null | undefined;
  const mounted = useMountedRef();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState(previous?.language ?? FALLBACK_LANGUAGE);
  const [group, setGroup] = useState(previous?.group ?? '');
  const [task, setTask] = useState<VoiceTask | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState<number | null>(null);
  const languages = useRemote(async () => (await callToolApi<VoiceLanguagesData>('mcpV1.vsGetSupportedLanguages'))?.languages ?? [], []);
  const groups = useRemote(async () => (await callToolApi<VoiceGroupsData>('mcpV1.vsGetAllGroups'))?.groups ?? [], []);
  const { error, running, run } = useToolRun<VoiceAddData>(tool.id, variant);
  const voice = languages.data?.find((entry) => entry.code === language)?.voice_id;
  const following = task !== null && !isTerminal(task.status);
  const steps = Object.entries(task?.steps ?? {});

  const follow = async (taskId: string): Promise<void> => {
    setFollowError(null);
    try {
      await pollUntil(
        async () => (await callToolApi<VoiceTaskData>('mcpV1.vsGetTaskStatus', taskId)).task,
        (current) => isTerminal(current.status),
        { intervalMs: POLL_INTERVAL_MS, maxAttempts: POLL_ATTEMPTS, isCancelled: () => !mounted.current, onTick: (current) => { if (mounted.current) setTask(current); } },
      );
    } catch (err) {
      if (mounted.current) setFollowError(describeError(t, err));
    }
  };

  const submit = async (): Promise<void> => {
    const input: ComposerInput = { text: text.trim(), language, group: group.trim() };
    if (!input.text || running || following) return;
    setTask(null);
    const added = await run(input, () => callToolApi<VoiceAddData>(tool.apiMethod, {
      text: input.text,
      language,
      target_language: language,
      ...(voice ? { voice } : {}),
      ...(input.group ? { group: input.group } : {}),
    }));
    if (added) {
      setQueueLength(added.queue_length);
      setTask(added.task);
      void follow(added.task_id);
      void groups.reload(true);
    }
  };

  const paste = async (): Promise<void> => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard access denied: the user can paste into the field */
    }
  };

  const outcome = task?.result?.item?.translated_text;

  return (
    <OpsPage>
      <OpsStatusBar accent="lime" mode="server">
        {following ? t('toolsOps.compose.processing') : task?.status === 'completed' ? t('toolsOps.compose.done') : t('toolsOps.compose.ready')}
        {queueLength !== null && ` · ${t('toolsOps.compose.queue_length', { count: queueLength })}`}
      </OpsStatusBar>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title={t('toolsOps.compose.text')}
          icon={Send}
          accent="lime"
          className="lg:col-span-3"
          actions={(
            <>
              <Btn size="sm" icon={ClipboardPaste} onClick={() => void paste()}>{t('toolsOps.translation.paste')}</Btn>
              <Btn size="sm" icon={Eraser} onClick={() => setText('')} disabled={!text}>{t('uiTools.common.clear')}</Btn>
            </>
          )}
        >
          <textarea
            value={text}
            maxLength={TEXT_MAX_CHARS}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit(); }}
            rows={12}
            placeholder={t('toolsOps.compose.placeholder')}
            className={`${controlClass('lime')} min-h-[16rem] resize-y`}
          />
          <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400">{text.length} / {TEXT_MAX_CHARS}</p>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel title={t('toolsOps.compose.options')} icon={Send} accent="lime">
            <div className="space-y-4">
              <Field label={t('toolsOps.compose.language')} hint={voice ? t('toolsOps.compose.voice', { voice }) : undefined}>
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className={controlClass('lime')}>
                  {(languages.data?.length ? languages.data : [{ code: FALLBACK_LANGUAGE, name: 'English', native_name: 'English', voice_id: '' }]).map((entry) => (
                    <option key={entry.code} value={entry.code}>{t(`uiTools.languages.${entry.code}`, { defaultValue: entry.native_name })} ({entry.code})</option>
                  ))}
                </select>
              </Field>
              <Field label={t('toolsOps.compose.group')} hint={t('toolsOps.compose.group_hint')}>
                <input value={group} onChange={(event) => setGroup(event.target.value)} list="ops-vs-groups" placeholder="default" className={controlClass('lime')} />
                <datalist id="ops-vs-groups">{(groups.data ?? []).map((name) => <option key={name} value={name} />)}</datalist>
              </Field>
              <Btn variant="primary" accent="lime" icon={Send} loading={running || following} onClick={() => void submit()} disabled={!text.trim()} className="w-full">
                {t('toolsOps.compose.submit')}
              </Btn>
              <p className="text-[11px] text-slate-400">{t('toolsOps.translation.shortcut')}</p>
              {error && <Notice tone="error">{error}</Notice>}
            </div>
          </Panel>

          {task && (
            <Panel title={t('toolsOps.compose.pipeline')} icon={Send} accent="lime" actions={<Pill tone={task.status === 'completed' ? 'emerald' : task.status === 'failed' ? 'rose' : 'amber'} tint>{task.status}</Pill>}>
              <ProgressBar done={task.progress ?? 0} total={100} tone={task.status === 'failed' ? 'rose' : 'emerald'} className="mb-3 h-2" label={t('toolsOps.compose.pipeline')} />
              <ol className="space-y-2">
                {steps.map(([key, step]) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5"><StepIcon status={step.status} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={step.status === 'pending' || step.status === 'skipped' ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}>{step.label ?? key}</span>
                      {step.message && <span className="block truncate text-[11px] text-slate-400">{step.message}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {task.error && <Notice tone="error" className="mt-3">{task.error}</Notice>}
              {followError && <Notice tone="warn" className="mt-3">{followError}</Notice>}
              {outcome && <p className="mt-3 rounded-lg bg-lime-50 p-3 text-sm text-lime-900 dark:bg-lime-500/10 dark:text-lime-200">{outcome}</p>}
            </Panel>
          )}
        </div>
      </div>
    </OpsPage>
  );
};

export default VsAddTextWorkbench;
