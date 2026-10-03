/** Conventional commit builder: type chips, scope / subject length meter, breaking change and a live terminal-style preview. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Terminal } from 'lucide-react';
import { Switch } from '@/shared/ui/Switch';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperInput, PaperTextarea, ToggleChip, prefillBool, prefillOneOf, prefillString, useToolRecord } from './textKit';
import { COMMIT_TYPES, SUBJECT_HARD_LIMIT, SUBJECT_SOFT_LIMIT, buildCommitMessage, buildGitCommand, buildHeader, lintCommit, type CommitDraft } from './logic/gitMemoLogic';

const SCOPE_SUGGESTIONS = ['ui', 'api', 'auth', 'deps', 'docs', 'config'];

const GitMemoWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [draft, setDraft] = useState<CommitDraft>(() => ({
    type: prefillOneOf(lastRun, 'type', COMMIT_TYPES, 'feat'),
    scope: prefillString(lastRun, 'scope', ''),
    subject: prefillString(lastRun, 'subject', ''),
    body: prefillString(lastRun, 'body', ''),
    breaking: prefillBool(lastRun, 'breaking', false),
    breakingNote: prefillString(lastRun, 'breakingNote', ''),
    footer: prefillString(lastRun, 'footer', ''),
  }));
  const patch = (next: Partial<CommitDraft>): void => setDraft((current) => ({ ...current, ...next }));

  const header = buildHeader(draft);
  const message = useMemo(() => buildCommitMessage(draft), [draft]);
  const command = useMemo(() => buildGitCommand(message), [message]);
  const warnings = useMemo(() => lintCommit(draft), [draft]);
  const headerLength = header.length;
  const meterTone = headerLength > SUBJECT_HARD_LIMIT ? 'bg-rose-500' : headerLength > SUBJECT_SOFT_LIMIT ? 'bg-amber-500' : 'bg-emerald-500';
  const hasSubject = draft.subject.trim().length > 0;
  const recordRun = (): void => record({ ...draft }, { header });

  return (
    <Desk wide>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Paper title={t('toolsText.git.type')}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('toolsText.git.type')}>
              {COMMIT_TYPES.map((type) => (
                <ToggleChip key={type} mono active={draft.type === type} onClick={() => patch({ type })} title={t(`toolsText.git.type_${type}`)}>{type}</ToggleChip>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><span className="font-mono font-bold text-violet-600 dark:text-violet-300">{draft.type}</span> - {t(`toolsText.git.type_${draft.type}`)}</p>
          </Paper>

          <Paper title={t('toolsText.git.summary')}>
            <div className="space-y-3">
              <div>
                <FieldLabel hint={t('toolsText.git.optional')}>{t('toolsText.git.scope')}</FieldLabel>
                <PaperInput value={draft.scope} onChange={(scope) => patch({ scope })} ariaLabel={t('toolsText.git.scope')} placeholder="api" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCOPE_SUGGESTIONS.map((scope) => <ToggleChip key={scope} mono active={draft.scope === scope} onClick={() => patch({ scope: draft.scope === scope ? '' : scope })}>{scope}</ToggleChip>)}
                </div>
              </div>
              <div>
                <FieldLabel hint={`${headerLength} / ${SUBJECT_HARD_LIMIT}`}>{t('toolsText.git.subject')}</FieldLabel>
                <PaperInput mono={false} value={draft.subject} onChange={(subject) => patch({ subject })} ariaLabel={t('toolsText.git.subject')} placeholder={t('toolsText.git.subject_placeholder')} />
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700"><div className={`h-full rounded-full transition-all ${meterTone}`} style={{ width: `${Math.min(100, (headerLength / SUBJECT_HARD_LIMIT) * 100)}%` }} /></div>
              </div>
              <div>
                <FieldLabel hint={t('toolsText.git.optional')}>{t('toolsText.git.body')}</FieldLabel>
                <PaperTextarea rows={5} value={draft.body} onChange={(body) => patch({ body })} ariaLabel={t('toolsText.git.body')} placeholder={t('toolsText.git.body_placeholder')} />
              </div>
            </div>
          </Paper>

          <Paper title={t('toolsText.git.extras')}>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><AlertTriangle className="h-4 w-4 text-rose-500" />{t('toolsText.git.breaking')}</span>
                <Switch on={draft.breaking} onChange={(breaking) => patch({ breaking })} tone="rose" label={t('toolsText.git.breaking')} />
              </label>
              {draft.breaking && (
                <div>
                  <FieldLabel>{t('toolsText.git.breaking_note')}</FieldLabel>
                  <PaperInput mono={false} value={draft.breakingNote} onChange={(breakingNote) => patch({ breakingNote })} ariaLabel={t('toolsText.git.breaking_note')} />
                </div>
              )}
              <div>
                <FieldLabel hint={t('toolsText.git.optional')}>{t('toolsText.git.footer')}</FieldLabel>
                <PaperInput value={draft.footer} onChange={(footer) => patch({ footer })} ariaLabel={t('toolsText.git.footer')} placeholder="Closes #123" />
              </div>
            </div>
          </Paper>
        </div>

        <div className="space-y-4 lg:col-span-2 lg:sticky lg:top-4 lg:self-start">
          <Paper
            title={<span className="inline-flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" />{t('toolsText.git.preview')}</span>}
            actions={<CopyButton text={message} label={t('toolsText.git.copy_message')} disabled={!hasSubject} onCopied={recordRun} />}
          >
            <div className="rounded-xl bg-slate-900 p-4 font-mono text-sm leading-relaxed text-slate-100 shadow-inner">
              <p className="break-words">
                <span className="font-bold text-violet-300">{draft.type}</span>
                {draft.scope.trim() && <span className="text-amber-300">({draft.scope.trim()})</span>}
                {draft.breaking && <span className="font-bold text-rose-400">!</span>}
                <span className="text-slate-400">: </span>
                <span className={hasSubject ? 'font-semibold text-white' : 'text-slate-500'}>{hasSubject ? draft.subject.trim() : t('toolsText.git.subject_placeholder')}</span>
              </p>
              {message.includes('\n') && <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-slate-300">{message.slice(message.indexOf('\n') + 2)}</pre>}
            </div>
            <div className="mt-3">
              <FieldLabel>{t('toolsText.git.command')}</FieldLabel>
              <pre className="overflow-x-auto rounded-xl bg-stone-100 px-3 py-2.5 font-mono text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{command}</pre>
              <div className="mt-2"><CopyButton text={command} label={t('toolsText.git.copy_command')} disabled={!hasSubject} onCopied={recordRun} /></div>
            </div>
          </Paper>

          {warnings.length > 0 && (
            <Notice tone="warn">
              <ul className="list-disc space-y-0.5 pl-4">
                {warnings.map((warning) => <li key={warning}>{t(`toolsText.git.warn_${warning}`, { soft: SUBJECT_SOFT_LIMIT, hard: SUBJECT_HARD_LIMIT })}</li>)}
              </ul>
            </Notice>
          )}
        </div>
      </div>
    </Desk>
  );
};

export default GitMemoWorkbench;
