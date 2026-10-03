/** Phone parser: calling-code detection, plausibility check by national length and every standard format on one card. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { SelectField } from '@/shared/ui/SelectField';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperInput, SoftButton, prefillString, useToolRecord } from './textKit';
import { parsePhone, phoneRegionOptions, regionCallingCode } from './logic/phoneLogic';

const EXAMPLES = ['+1 (212) 555-0123', '+44 20 7946 0958', '+81 3-1234-5678', '+49 30 123456', '+61 412 345 678'];
const FLAG_OFFSET = 127397;
const SELECT_THEME = 'border border-stone-200 bg-[#fffdf8] text-slate-800 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-100';

const flagOf = (region: string | null): string => (region ? String.fromCodePoint(...Array.from(region).map((char) => char.charCodeAt(0) + FLAG_OFFSET)) : '');

const PhoneParserWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [phone, setPhone] = useState(() => prefillString(lastRun, 'phone', EXAMPLES[0]));
  const [region, setRegion] = useState(() => prefillString(lastRun, 'country', 'US'));
  const locale = i18n.language || 'en';

  const regionName = (code: string): string => {
    try {
      return new Intl.DisplayNames(locale, { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const regionOptions = useMemo(() => phoneRegionOptions()
    .map((code) => ({ value: code, label: `${flagOf(code)} ${regionName(code)} (+${regionCallingCode(code)})` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale)), [locale]);
  const report = useMemo(() => parsePhone(phone, region), [phone, region]);
  const formats = report.region ? ([
    ['international', report.international],
    ['national', report.nationalFormat],
    ['e164', report.e164],
    ['uri', report.uri],
  ] as const) : [];

  return (
    <Desk>
      <Paper title={t('toolsText.phone.number')}>
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <FieldLabel hint={t('toolsText.phone.hint')}>{t('toolsText.phone.label')}</FieldLabel>
            <PaperInput value={phone} onChange={setPhone} inputMode="tel" ariaLabel={t('toolsText.phone.label')} placeholder="+1 212 555 0123" className="py-3 text-lg" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>{t('toolsText.phone.default_region')}</FieldLabel>
            <SelectField value={region} options={regionOptions} onChange={(next) => setRegion(next)} inputClassName={SELECT_THEME} />
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('toolsText.phone.examples')}>
          {EXAMPLES.map((example) => <SoftButton key={example} className="shrink-0 font-mono" onClick={() => setPhone(example)}>{example}</SoftButton>)}
        </div>
      </Paper>

      {report.issue === 'empty' || report.issue === 'noDigits' ? (
        <Notice tone="info">{t('toolsText.phone.enter')}</Notice>
      ) : (
        <Paper title={t('toolsText.phone.card')} actions={<CopyButton text={report.e164} label={t('toolsText.phone.copy_e164')} onCopied={() => record({ phone, country: region }, { e164: report.e164, valid: report.valid })} disabled={!report.region} />}>
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${report.valid ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'}`} aria-hidden>
              {report.region ? flagOf(report.region) : <Phone className="h-6 w-6 text-rose-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{report.region ? regionName(report.region) : t('toolsText.phone.unknown_region')}</p>
              <p className={`text-xs font-semibold ${report.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {report.valid ? t('toolsText.phone.plausible') : t(`toolsText.phone.issue_${report.issue ?? 'tooShort'}`, { min: report.expected?.min ?? 0, max: report.expected?.max ?? 0, n: report.national.length })}
              </p>
            </div>
            {report.region && (
              <p className="font-mono text-2xl font-black tracking-wide" aria-label={t('toolsText.phone.anatomy')}>
                <span className="rounded-l-lg bg-violet-100 px-2 py-1 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200">+{report.code}</span>
                <span className="rounded-r-lg bg-sky-100 px-2 py-1 text-sky-700 dark:bg-sky-500/25 dark:text-sky-200">{report.national}</span>
              </p>
            )}
          </div>

          {formats.length > 0 && (
            <dl className="mt-5 grid gap-2 sm:grid-cols-2">
              {formats.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(`toolsText.phone.format_${key}`)}</dt>
                    <dd className="truncate font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                  <CopyButton text={value} iconOnly />
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-[11px] text-slate-400">{t('toolsText.phone.disclaimer')}</p>
        </Paper>
      )}
    </Desk>
  );
};

export default PhoneParserWorkbench;
