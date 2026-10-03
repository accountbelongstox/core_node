/** Age calculator: ticking years-to-seconds counter, lifetime totals and a next-birthday countdown. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cake, CalendarDays } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, FIELD_CLASS, FieldLabel, Lcd, MUTED_TEXT, Notice, Seg, Stat, pad2, prefillInput, useAccent, useAutoRecord, useNow, useRecordUse } from './calcKit';
import { calendarDiff, daysBetween, nextBirthday, parseDateInput, splitSeconds, toDateInput } from './mathLogic';

type AsOfMode = 'today' | 'date';

const MS_PER_SECOND = 1000;
const UNITS = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const;

const AgeWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { birth: '', asOf: toDateInput(new Date()), asOfMode: 'today' }), [lastRun]);
  const [birthText, setBirthText] = useState(initial.birth);
  const [asOfText, setAsOfText] = useState(initial.asOf);
  const [asOfMode, setAsOfMode] = useState<AsOfMode>(initial.asOfMode === 'date' ? 'date' : 'today');
  const live = asOfMode === 'today';
  const now = useNow(MS_PER_SECOND, live);

  const birth = parseDateInput(birthText);
  const target = useMemo(() => {
    if (live) return new Date(now);
    const d = parseDateInput(asOfText);
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) : null;
  }, [live, now, asOfText]);

  const age = birth && target && birth.getTime() <= target.getTime() ? calendarDiff(birth, target) : null;
  const future = birth && target && birth.getTime() > target.getTime();
  const totalDays = birth && target && age ? daysBetween(birth, target) : 0;
  const totalSeconds = birth && target && age ? Math.floor((target.getTime() - birth.getTime()) / MS_PER_SECOND) : 0;
  const upcoming = birth && target && age ? nextBirthday(birth, target) : null;
  const countdown = upcoming ? splitSeconds(Math.max(0, upcoming.msLeft) / MS_PER_SECOND) : null;
  const lastAnniversary = upcoming ? new Date(upcoming.date.getFullYear() - 1, upcoming.date.getMonth(), upcoming.date.getDate()) : null;
  const yearProgress = upcoming && lastAnniversary && target
    ? Math.min(1, Math.max(0, (target.getTime() - lastAnniversary.getTime()) / (upcoming.date.getTime() - lastAnniversary.getTime())))
    : 0;
  const weekday = upcoming ? new Intl.DateTimeFormat(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(upcoming.date) : '';
  const nf = new Intl.NumberFormat(i18n.language);
  const summary = age ? `${age.years}y ${age.months}m ${age.days}d` : '';

  useAutoRecord(record, { birth: birthText, asOf: asOfText, asOfMode }, { age: summary }, age !== null);

  const totals: Array<[string, number]> = age ? [
    ['months', age.years * 12 + age.months],
    ['weeks', Math.floor(totalDays / 7)],
    ['days', totalDays],
    ['hours', Math.floor(totalSeconds / 3600)],
    ['minutes', Math.floor(totalSeconds / 60)],
    ['seconds', totalSeconds],
  ] : [];

  return (
    <Bench accent="math">
      <Card title={t('toolsCalc.age.dates')} icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="age-birth">{t('toolsCalc.age.birth')}</FieldLabel>
            <input id="age-birth" type="date" value={birthText} max={toDateInput(new Date())} onChange={(event) => setBirthText(event.target.value)} className={`${FIELD_CLASS} ${a.focus}`} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <FieldLabel className="mb-0" htmlFor="age-asof">{t('toolsCalc.age.as_of')}</FieldLabel>
              <Seg value={asOfMode} onChange={setAsOfMode} ariaLabel={t('toolsCalc.age.as_of')} options={[{ value: 'today', label: t('toolsCalc.age.today') }, { value: 'date', label: t('toolsCalc.age.pick_date') }]} />
            </div>
            <input id="age-asof" type="date" value={live ? toDateInput(new Date(now)) : asOfText} disabled={live} onChange={(event) => setAsOfText(event.target.value)} className={`${FIELD_CLASS} ${a.focus} disabled:opacity-50`} />
          </div>
        </div>
      </Card>

      {future && <Notice>{t('toolsCalc.age.future')}</Notice>}
      {!birth && !future && <Notice tone="info">{t('toolsCalc.age.empty')}</Notice>}

      {age && (
        <>
          <Lcd>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 text-center sm:grid-cols-6">
              {UNITS.map((unit) => (
                <div key={unit} className="min-w-0">
                  <p className="text-4xl font-bold leading-none sm:text-5xl">{unit === 'years' || unit === 'months' || unit === 'days' ? age[unit] : pad2(age[unit])}</p>
                  <p className="mt-1.5 truncate text-[10px] uppercase tracking-wider opacity-60">{t(`toolsCalc.age.unit_${unit}`)}</p>
                </div>
              ))}
            </div>
          </Lcd>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {totals.map(([unit, value]) => <Stat key={unit} label={t(`toolsCalc.age.total_${unit}`)} value={nf.format(value)} />)}
          </div>

          {upcoming && countdown && (
            <Card title={t('toolsCalc.age.next_birthday')} icon={<Cake className="h-3.5 w-3.5" />} aside={<CopyButton text={summary} label={t('toolsCalc.common.copy')}>{t('toolsCalc.common.copy')}</CopyButton>}>
              {upcoming.today ? (
                <p className={`text-xl font-bold ${a.text}`}>{t('toolsCalc.age.birthday_today', { age: upcoming.turning })}</p>
              ) : (
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <p className={`font-mono text-4xl font-bold ${a.text}`}>{countdown.d}<span className="ml-1 text-base">{t('toolsCalc.age.days_left')}</span></p>
                    <p className="mt-1 font-mono text-lg text-slate-700 dark:text-slate-200">{pad2(countdown.h)}:{pad2(countdown.m)}:{pad2(countdown.s)}</p>
                  </div>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{weekday}</p>
                    <p className={`text-xs ${MUTED_TEXT}`}>{t('toolsCalc.age.turning', { age: upcoming.turning })}</p>
                  </div>
                </div>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${yearProgress * 100}%` }} />
              </div>
              <p className={`mt-1 text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.age.year_progress', { percent: Math.round(yearProgress * 100) })}</p>
            </Card>
          )}
        </>
      )}
    </Bench>
  );
};

export default AgeWorkbench;
