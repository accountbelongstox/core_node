/** Email normalizer: provider-aware alias rules applied live to a list of addresses, with duplicate detection. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CopyCheck, MailCheck, MailX } from 'lucide-react';
import { Switch } from '@/shared/ui/Switch';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Paper, PaperTextarea, Tile, prefillBool, prefillString, useDebounced, useToolRecord } from './textKit';
import { DEFAULT_EMAIL_RULES, normalizeEmailList, type EmailRules } from './logic/emailLogic';

const SAMPLE = 'John.Doe+newsletter@Gmail.com\njohndoe@googlemail.com\nj.o.h.n.d.o.e@gmail.com\nSales+EU@Example.COM\nnot-an-email';
const RULE_KEYS = ['lowercase', 'stripPlus', 'stripDots', 'mergeGooglemail', 'allDomains'] as const;

const EmailNormalizerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [text, setText] = useState(() => prefillString(lastRun, 'emails', SAMPLE));
  const [rules, setRules] = useState<EmailRules>(() => {
    const next = { ...DEFAULT_EMAIL_RULES };
    RULE_KEYS.forEach((key) => { next[key] = prefillBool(lastRun, key, DEFAULT_EMAIL_RULES[key]); });
    return next;
  });
  const live = useDebounced(text, 100);
  const rows = useMemo(() => normalizeEmailList(live, rules), [live, rules]);

  const valid = rows.filter((row) => row.valid);
  const unique = valid.filter((row) => row.duplicateOf === null).map((row) => row.normalized);
  const changed = valid.filter((row) => row.normalized !== row.original.trim()).length;
  const duplicates = valid.length - unique.length;
  const recordRun = (): void => record({ emails: text, ...rules }, { total: rows.length, unique: unique.length });

  return (
    <Desk wide>
      <Paper title={t('toolsText.email.rules')}>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {RULE_KEYS.map((key) => (
            <label key={key} className="flex cursor-pointer items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{t(`toolsText.email.rule_${key}`)}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t(`toolsText.email.rule_${key}_hint`)}</span>
              </span>
              <Switch on={rules[key]} onChange={(on) => setRules((current) => ({ ...current, [key]: on }))} label={t(`toolsText.email.rule_${key}`)} className="mt-0.5" />
            </label>
          ))}
        </div>
      </Paper>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t('toolsText.email.stat_total')} value={rows.length} />
        <Tile label={t('toolsText.email.stat_valid')} value={valid.length} />
        <Tile label={t('toolsText.email.stat_changed')} value={changed} />
        <Tile accent label={t('toolsText.email.stat_unique')} value={unique.length} hint={duplicates > 0 ? t('toolsText.email.duplicates', { n: duplicates }) : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Paper title={t('toolsText.email.input')}>
          <FieldLabel hint={t('toolsText.email.input_hint')}>{t('toolsText.email.addresses')}</FieldLabel>
          <PaperTextarea mono rows={12} value={text} onChange={setText} ariaLabel={t('toolsText.email.addresses')} placeholder="name+tag@example.com" />
        </Paper>

        <Paper
          title={t('toolsText.email.result')}
          actions={(
            <>
              <CopyButton text={rows.filter((row) => row.valid).map((row) => row.normalized).join('\n')} label={t('toolsText.email.copy_all')} onCopied={recordRun} />
              <CopyButton text={unique.join('\n')} label={t('toolsText.email.copy_unique')} onCopied={recordRun} />
            </>
          )}
        >
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">{t('toolsText.email.empty')}</p>
          ) : (
            <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <li key={index} className={`rounded-xl border p-2.5 ${row.valid ? 'border-stone-200 bg-stone-50/60 dark:border-slate-700/60 dark:bg-slate-800/40' : 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10'}`}>
                  <div className="flex items-start gap-2">
                    {row.valid ? <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <MailX className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                    <div className="min-w-0 flex-1 space-y-0.5 font-mono text-xs">
                      <p className="flex items-center gap-1.5 break-all text-slate-400"><span className="line-through decoration-slate-300">{row.original}</span></p>
                      <p className="flex items-center gap-1.5 break-all text-sm font-bold text-slate-800 dark:text-slate-100"><ArrowRight className="h-3 w-3 shrink-0 text-violet-500" />{row.normalized}</p>
                    </div>
                    <CopyButton text={row.normalized} iconOnly />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                    {!row.valid && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">{t('toolsText.email.invalid')}</span>}
                    {row.changes.map((change) => <span key={change} className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{t(`toolsText.email.change_${change}`)}</span>)}
                    {row.duplicateOf !== null && <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"><CopyCheck className="h-3 w-3" />{t('toolsText.email.duplicate_of', { n: row.duplicateOf + 1 })}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Paper>
      </div>
    </Desk>
  );
};

export default EmailNormalizerWorkbench;
