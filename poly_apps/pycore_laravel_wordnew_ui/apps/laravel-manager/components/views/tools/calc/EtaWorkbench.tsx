/** ETA calculator: remaining time and finish clock from progress so far, or from a size and a speed. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Flag } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, FieldLabel, Lcd, MUTED_TEXT, NumField, Seg, Stat, formatFixed, pad2, prefillInput, useAccent, useAutoRecord, useNow, useRecordUse } from './calcKit';
import { etaFromProgress, splitSeconds } from './mathLogic';

type EtaMode = 'progress' | 'speed';
type SpeedUnit = 1 | 60 | 3600;

const SPEED_UNITS: readonly SpeedUnit[] = [1, 60, 3600];
const SPEED_UNIT_KEY: Record<SpeedUnit, string> = { 1: 'second', 60: 'minute', 3600: 'hour' };
const MS_PER_SECOND = 1000;

const clock = (d: number, h: number, m: number, s: number): string => `${d > 0 ? `${d}d ` : ''}${pad2(h)}:${pad2(m)}:${pad2(s)}`;

const EtaWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { mode: 'progress', total: 1000, done: 250, h: 0, m: 5, s: 0, amount: 500, speed: 25, unit: 60 }), [lastRun]);
  const [mode, setMode] = useState<EtaMode>(initial.mode === 'speed' ? 'speed' : 'progress');
  const [total, setTotal] = useState(initial.total);
  const [done, setDone] = useState(initial.done);
  const [hours, setHours] = useState(initial.h);
  const [minutes, setMinutes] = useState(initial.m);
  const [seconds, setSeconds] = useState(initial.s);
  const [amount, setAmount] = useState(initial.amount);
  const [speed, setSpeed] = useState(initial.speed);
  const [unit, setUnit] = useState<SpeedUnit>(SPEED_UNITS.includes(initial.unit as SpeedUnit) ? (initial.unit as SpeedUnit) : 60);
  const now = useNow(MS_PER_SECOND);

  const outcome = useMemo(() => {
    if (mode === 'progress') {
      const elapsed = (Number.isFinite(hours) ? hours : 0) * 3600 + (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
      const eta = etaFromProgress(total, done, elapsed);
      return eta && { remaining: eta.remainingSeconds, fraction: eta.fraction, rate: eta.rate, totalSeconds: eta.totalSeconds, elapsed };
    }
    if (!(amount > 0) || !(speed > 0)) return null;
    const perSecond = speed / unit;
    return { remaining: amount / perSecond, fraction: 0, rate: perSecond, totalSeconds: amount / perSecond, elapsed: 0 };
  }, [mode, total, done, hours, minutes, seconds, amount, speed, unit]);

  const parts = outcome ? splitSeconds(outcome.remaining) : null;
  const finish = outcome ? new Date(now + outcome.remaining * MS_PER_SECOND) : null;
  const sameDay = finish ? finish.toDateString() === new Date(now).toDateString() : true;
  const timeFmt = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
  const percent = outcome ? outcome.fraction * 100 : 0;

  useAutoRecord(record, { mode, total, done, h: hours, m: minutes, s: seconds, amount, speed, unit }, { remaining: outcome?.remaining ?? 0 }, outcome !== null);

  const timeInput = (value: number, onChange: (n: number) => void, suffix: string, label: string): React.ReactNode => (
    <NumField value={value} onChange={onChange} min={0} ariaLabel={label} suffix={suffix} className="w-24" />
  );

  return (
    <Bench accent="math">
      <Seg
        value={mode}
        onChange={setMode}
        ariaLabel={t('toolsCalc.eta.mode')}
        options={[{ value: 'progress', label: t('toolsCalc.eta.mode_progress') }, { value: 'speed', label: t('toolsCalc.eta.mode_speed') }]}
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title={t('toolsCalc.eta.inputs')} icon={<Clock className="h-3.5 w-3.5" />}>
          {mode === 'progress' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>{t('toolsCalc.eta.total')}</FieldLabel><NumField value={total} onChange={setTotal} min={0} ariaLabel={t('toolsCalc.eta.total')} /></div>
                <div><FieldLabel>{t('toolsCalc.eta.done')}</FieldLabel><NumField value={done} onChange={setDone} min={0} ariaLabel={t('toolsCalc.eta.done')} /></div>
              </div>
              <div>
                <FieldLabel>{t('toolsCalc.eta.elapsed')}</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {timeInput(hours, setHours, 'h', t('toolsCalc.eta.hours'))}
                  {timeInput(minutes, setMinutes, 'm', t('toolsCalc.eta.minutes'))}
                  {timeInput(seconds, setSeconds, 's', t('toolsCalc.eta.seconds'))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><FieldLabel>{t('toolsCalc.eta.amount')}</FieldLabel><NumField value={amount} onChange={setAmount} min={0} ariaLabel={t('toolsCalc.eta.amount')} /></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <div><FieldLabel>{t('toolsCalc.eta.speed')}</FieldLabel><NumField value={speed} onChange={setSpeed} min={0} ariaLabel={t('toolsCalc.eta.speed')} /></div>
                <Seg value={unit} onChange={setUnit} ariaLabel={t('toolsCalc.eta.per')} options={SPEED_UNITS.map((u) => ({ value: u, label: t(`toolsCalc.eta.per_${SPEED_UNIT_KEY[u]}`) }))} />
              </div>
            </div>
          )}
        </Card>

        <Lcd className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider opacity-60">{t('toolsCalc.eta.remaining')}</p>
          <p className="break-all text-4xl font-bold sm:text-5xl">{parts ? clock(parts.d, parts.h, parts.m, parts.s) : '—'}</p>
          {outcome && mode === 'progress' && (
            <div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${a.bar} transition-[width] duration-500`} style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] opacity-70"><span>{formatFixed(percent, 1, i18n.language)}%</span><span>{formatFixed(100 - percent, 1, i18n.language)}%</span></div>
            </div>
          )}
          {finish && (
            <div className="flex items-center gap-2 text-sm">
              <Flag className="h-4 w-4 shrink-0 opacity-70" />
              <span className="opacity-70">{t('toolsCalc.eta.finish')}</span>
              <span className="font-bold">{timeFmt.format(finish)}</span>
              {!sameDay && <span className="opacity-70">{dateFmt.format(finish)}</span>}
            </div>
          )}
          {!outcome && <p className="text-xs opacity-70">{t('toolsCalc.eta.need_values')}</p>}
        </Lcd>
      </div>

      {outcome && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t('toolsCalc.eta.rate_second')} value={formatFixed(outcome.rate, outcome.rate < 10 ? 3 : 1, i18n.language)} />
          <Stat label={t('toolsCalc.eta.rate_minute')} value={formatFixed(outcome.rate * 60, 1, i18n.language)} />
          <Stat label={t('toolsCalc.eta.rate_hour')} value={formatFixed(outcome.rate * 3600, 0, i18n.language)} />
          <Stat label={t('toolsCalc.eta.total_time')} value={(() => { const p = splitSeconds(outcome.totalSeconds); return clock(p.d, p.h, p.m, p.s); })()} />
        </div>
      )}
      {outcome && <div className={`flex items-center gap-2 text-xs ${MUTED_TEXT}`}><CopyButton text={finish ? timeFmt.format(finish) : ''} label={t('toolsCalc.common.copy')}>{t('toolsCalc.eta.copy_finish')}</CopyButton></div>}
    </Bench>
  );
};

export default EtaWorkbench;
