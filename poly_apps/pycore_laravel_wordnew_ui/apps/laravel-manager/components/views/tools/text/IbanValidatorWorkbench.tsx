/** IBAN validator: live mod-97 check, color-coded country / check digits / BBAN anatomy and working steps. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperInput, SoftButton, prefillString, useToolRecord } from './textKit';
import { IBAN_EXAMPLES, analyzeIban, groupIban, type IbanReport } from './logic/ibanLogic';

const SEGMENT_TONE: Record<string, string> = {
  country: 'bg-violet-100 text-violet-800 dark:bg-violet-500/25 dark:text-violet-200',
  check: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200',
  bank: 'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200',
  branch: 'bg-teal-100 text-teal-800 dark:bg-teal-500/25 dark:text-teal-200',
  sort: 'bg-teal-100 text-teal-800 dark:bg-teal-500/25 dark:text-teal-200',
  cin: 'bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200',
  account: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200',
  bban: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
};

const FLAG_OFFSET = 127397;

const flagOf = (country: string): string => (/^[A-Z]{2}$/.test(country)
  ? String.fromCodePoint(...Array.from(country).map((char) => char.charCodeAt(0) + FLAG_OFFSET))
  : '');

const kindsOf = (report: IbanReport): string[] => {
  const kinds: string[] = Array.from(report.clean, (_, index) => (index < 2 ? 'country' : index < 4 ? 'check' : 'bban'));
  let cursor = 4;
  report.parts.forEach((part) => {
    for (let i = 0; i < part.length; i += 1) kinds[cursor + i] = part.key === 'check' ? 'check' : part.key;
    cursor += part.length;
  });
  return kinds;
};

const IbanValidatorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [input, setInput] = useState(() => prefillString(lastRun, 'iban', IBAN_EXAMPLES[0]));
  const report = useMemo(() => analyzeIban(input), [input]);
  const kinds = useMemo(() => kindsOf(report), [report]);

  const countryName = useMemo(() => {
    try {
      return new Intl.DisplayNames(i18n.language || 'en', { type: 'region' }).of(report.country) ?? report.country;
    } catch {
      return report.country;
    }
  }, [report.country, i18n.language]);
  const recordRun = (): void => record({ iban: report.clean }, { valid: report.valid });
  const chunks: string[] = report.clean.match(/.{1,4}/g) ?? [];
  const progress = report.expectedLength ? Math.min(100, Math.round((report.clean.length / report.expectedLength) * 100)) : 0;

  return (
    <Desk>
      <Paper title={t('toolsText.iban.number')}>
        <FieldLabel hint={t('toolsText.iban.hint')}>{t('toolsText.iban.label')}</FieldLabel>
        <PaperInput value={input} onChange={setInput} invalid={Boolean(report.issue) && report.issue !== 'empty'} ariaLabel={t('toolsText.iban.label')} placeholder="DE89 3704 0044 0532 0130 00" className="py-3 text-lg uppercase tracking-wider" />
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('toolsText.iban.examples')}>
          {IBAN_EXAMPLES.map((example) => (
            <SoftButton key={example} className="shrink-0" onClick={() => setInput(groupIban(example))}><span aria-hidden>{flagOf(example.slice(0, 2))}</span><span className="font-mono">{example.slice(0, 2)}</span></SoftButton>
          ))}
        </div>
      </Paper>

      {report.issue === 'empty' ? (
        <Notice tone="info">{t('toolsText.iban.enter')}</Notice>
      ) : (
        <>
          <Paper
            title={t('toolsText.iban.verdict')}
            actions={(
              <>
                <CopyButton text={report.grouped} label={t('toolsText.iban.copy_formatted')} onCopied={recordRun} />
                <CopyButton text={report.clean} label={t('toolsText.iban.copy_electronic')} onCopied={recordRun} />
              </>
            )}
          >
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${report.valid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`} role="status">
              {report.valid ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <XCircle className="h-6 w-6 shrink-0" />}
              <div className="min-w-0">
                <p className="text-base font-bold">{report.valid ? t('toolsText.iban.valid') : t('toolsText.iban.invalid')}</p>
                {report.issue && <p className="text-xs opacity-90">{t(`toolsText.iban.issue_${report.issue}`, { expected: report.expectedLength ?? 0, actual: report.clean.length, country: report.country })}</p>}
              </div>
              <span className="ml-auto shrink-0 text-3xl" aria-hidden>{flagOf(report.country)}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 font-mono text-lg font-bold" aria-label={t('toolsText.iban.anatomy')}>
              {chunks.map((chunk, chunkIndex) => (
                <span key={chunkIndex} className="inline-flex overflow-hidden rounded-lg">
                  {Array.from(chunk).map((char, index) => (
                    <span key={index} className={`px-1.5 py-1 ${SEGMENT_TONE[kinds[chunkIndex * 4 + index]] ?? SEGMENT_TONE.bban}`}>{char}</span>
                  ))}
                </span>
              ))}
            </div>

            {report.expectedLength && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{t('toolsText.iban.length')}</span><span className="font-mono">{report.clean.length} / {report.expectedLength}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700"><div className={`h-full rounded-full ${report.clean.length === report.expectedLength ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </Paper>

          <div className="grid gap-4 md:grid-cols-2">
            <Paper title={t('toolsText.iban.breakdown')}>
              <dl className="space-y-2 text-sm">
                {([
                  ['country', report.country ? `${report.country} - ${countryName}` : '-'],
                  ['check', report.checkDigits || '-'],
                  ['bban', report.bban || '-'],
                ] as const).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <dt className="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><span className={`h-2.5 w-2.5 rounded-full ${SEGMENT_TONE[key].split(' ')[0]} ring-1 ring-current`} />{t(`toolsText.iban.part_${key}`)}</dt>
                    <dd className="min-w-0 break-all text-right font-mono text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
                {report.parts.length > 0 && (
                  <div className="space-y-1.5 border-t border-stone-200 pt-2 dark:border-slate-700/60">
                    {report.parts.map((part, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 text-xs">
                        <span className={`rounded-md px-1.5 py-0.5 font-semibold ${SEGMENT_TONE[part.key]}`}>{t(`toolsText.iban.part_${part.key}`)}</span>
                        <span className="font-mono text-slate-700 dark:text-slate-200">{part.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </dl>
            </Paper>

            <Paper title={t('toolsText.iban.checksum')}>
              {report.numeric ? (
                <ol className="space-y-3 text-xs">
                  <li>
                    <p className="font-bold text-slate-500">{t('toolsText.iban.step_move')}</p>
                    <p className="mt-1 break-all rounded-lg bg-stone-50 px-2 py-1.5 font-mono dark:bg-slate-800/50">{report.rearranged}</p>
                  </li>
                  <li>
                    <p className="font-bold text-slate-500">{t('toolsText.iban.step_numeric')}</p>
                    <p className="mt-1 break-all rounded-lg bg-stone-50 px-2 py-1.5 font-mono dark:bg-slate-800/50">{report.numeric}</p>
                  </li>
                  <li>
                    <p className="font-bold text-slate-500">{t('toolsText.iban.step_mod')}</p>
                    <p className={`mt-1 rounded-lg px-2 py-1.5 font-mono font-bold ${report.remainder === 1 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>mod 97 = {report.remainder} {report.remainder === 1 ? '=' : '≠'} 1</p>
                  </li>
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">{t('toolsText.iban.no_checksum')}</p>
              )}
            </Paper>
          </div>
        </>
      )}
    </Desk>
  );
};

export default IbanValidatorWorkbench;
