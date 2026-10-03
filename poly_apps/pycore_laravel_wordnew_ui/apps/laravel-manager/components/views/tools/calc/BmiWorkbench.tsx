/** BMI calculator: metric/imperial sliders and a coloured category gauge with a live marker. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ruler, Scale } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, Lcd, MUTED_TEXT, NumField, Seg, Slider, Stat, formatFixed, prefillInput, useAutoRecord, useRecordUse } from './calcKit';
import { BMI_BANDS, CM_PER_INCH, LB_PER_KG, calculateBmi, type BmiBand } from './mathLogic';

type Units = 'metric' | 'imperial';

const GAUGE = { min: 12, max: 42 };
const TICKS = [18.5, 25, 30, 35, 40];
const BAND_STYLE: Record<BmiBand, { bar: string; text: string }> = {
  under: { bar: 'bg-sky-400', text: 'text-sky-500' },
  normal: { bar: 'bg-emerald-500', text: 'text-emerald-500' },
  over: { bar: 'bg-amber-400', text: 'text-amber-500' },
  obese1: { bar: 'bg-orange-500', text: 'text-orange-500' },
  obese2: { bar: 'bg-red-500', text: 'text-red-500' },
  obese3: { bar: 'bg-red-800', text: 'text-red-700 dark:text-red-400' },
};
const MIN_INCHES = 40;
const MAX_INCHES = 90;
const INCHES_PER_FOOT = 12;

const gaugePercent = (bmi: number): number => ((Math.min(GAUGE.max, Math.max(GAUGE.min, bmi)) - GAUGE.min) / (GAUGE.max - GAUGE.min)) * 100;

const BmiWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { units: 'metric', cm: 170, kg: 65, inches: 67, lb: 143 }), [lastRun]);
  const [units, setUnits] = useState<Units>(initial.units === 'imperial' ? 'imperial' : 'metric');
  const [cm, setCm] = useState(initial.cm);
  const [kg, setKg] = useState(initial.kg);
  const [inches, setInches] = useState(initial.inches);
  const [lb, setLb] = useState(initial.lb);
  const metric = units === 'metric';

  const switchUnits = (next: Units): void => {
    if (next === units) return;
    if (next === 'imperial') {
      if (Number.isFinite(cm)) setInches(Math.round(Math.min(MAX_INCHES, Math.max(MIN_INCHES, cm / CM_PER_INCH))));
      if (Number.isFinite(kg)) setLb(Math.round(kg * LB_PER_KG));
    } else {
      if (Number.isFinite(inches)) setCm(Math.round(inches * CM_PER_INCH));
      if (Number.isFinite(lb)) setKg(Math.round((lb / LB_PER_KG) * 2) / 2);
    }
    setUnits(next);
  };

  const heightCm = metric ? cm : inches * CM_PER_INCH;
  const weightKg = metric ? kg : lb / LB_PER_KG;
  const result = useMemo(() => calculateBmi(heightCm, weightKg), [heightCm, weightKg]);
  const style = result ? BAND_STYLE[result.band] : null;
  const weightUnit = metric ? 'kg' : 'lb';
  const toWeight = (valueKg: number): number => (metric ? valueKg : valueKg * LB_PER_KG);
  const bmiText = result ? formatFixed(result.bmi, 1, i18n.language) : '—';

  useAutoRecord(record, { units, cm, kg, inches, lb }, { bmi: bmiText, band: result?.band ?? '' }, result !== null);

  return (
    <Bench accent="math">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card
          title={t('toolsCalc.bmi.body')}
          icon={<Ruler className="h-3.5 w-3.5" />}
          aside={<Seg value={units} onChange={switchUnits} ariaLabel={t('toolsCalc.bmi.units')} options={[{ value: 'metric', label: t('toolsCalc.bmi.metric') }, { value: 'imperial', label: t('toolsCalc.bmi.imperial') }]} />}
        >
          <div className="space-y-5">
            {metric ? (
              <Slider label={t('toolsCalc.bmi.height')} value={cm} min={100} max={220} step={1} onChange={setCm} suffix=" cm" />
            ) : (
              <Slider
                label={t('toolsCalc.bmi.height')}
                value={inches}
                min={MIN_INCHES}
                max={MAX_INCHES}
                step={1}
                onChange={setInches}
                format={(v) => (Number.isFinite(v) ? `${Math.floor(v / INCHES_PER_FOOT)}′ ${Math.round(v % INCHES_PER_FOOT)}″` : '—')}
              />
            )}
            {metric
              ? <Slider label={t('toolsCalc.bmi.weight')} value={kg} min={20} max={200} step={0.5} onChange={setKg} suffix=" kg" />
              : <Slider label={t('toolsCalc.bmi.weight')} value={lb} min={44} max={440} step={1} onChange={setLb} suffix=" lb" />}
            <div className="flex items-center gap-2">
              <Scale className={`h-4 w-4 ${MUTED_TEXT}`} />
              <NumField value={weightUnit === 'kg' ? kg : lb} onChange={metric ? setKg : setLb} min={1} max={700} ariaLabel={t('toolsCalc.bmi.weight_exact')} suffix={` ${weightUnit}`} className="w-36" />
              <span className={`text-xs ${MUTED_TEXT}`}>{t('toolsCalc.bmi.weight_exact')}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Lcd className="space-y-1 text-center">
            <p className="text-[11px] uppercase tracking-wider opacity-60">{t('toolsCalc.bmi.your_bmi')}</p>
            <p className="text-6xl font-bold sm:text-7xl">{bmiText}</p>
            {result && style && <p className={`text-lg font-bold ${style.text}`}>{t(`toolsCalc.bmi.band_${result.band}`)}</p>}
          </Lcd>

          <Card>
            <div className="relative pt-7">
              {result && (
                <div className="absolute top-0 -translate-x-1/2 transition-[left] duration-300" style={{ left: `${gaugePercent(result.bmi)}%` }}>
                  <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">{bmiText}</span>
                  <span className="mx-auto mt-0.5 block h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-white" />
                </div>
              )}
              <div className="flex h-4 overflow-hidden rounded-full">
                {BMI_BANDS.map((b) => {
                  const from = Math.max(b.from, GAUGE.min);
                  const to = Math.min(b.to, GAUGE.max);
                  return to > from ? <div key={b.band} className={`${BAND_STYLE[b.band].bar} ${result?.band === b.band ? '' : 'opacity-50'} transition-opacity`} style={{ width: `${((to - from) / (GAUGE.max - GAUGE.min)) * 100}%` }} title={t(`toolsCalc.bmi.band_${b.band}`)} /> : null;
                })}
              </div>
              <div className="relative mt-1 h-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {TICKS.map((tick) => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${gaugePercent(tick)}%` }}>{tick}</span>)}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={t('toolsCalc.bmi.healthy_range')} value={`${formatFixed(toWeight(result.healthyMinKg), 1, i18n.language)} – ${formatFixed(toWeight(result.healthyMaxKg), 1, i18n.language)} ${weightUnit}`} />
          <Stat
            label={t('toolsCalc.bmi.to_healthy')}
            value={result.deltaKg === 0 ? t('toolsCalc.bmi.in_range') : `${result.deltaKg > 0 ? '+' : '−'}${formatFixed(Math.abs(toWeight(result.deltaKg)), 1, i18n.language)} ${weightUnit}`}
            valueClassName={result.deltaKg === 0 ? 'text-emerald-500' : ''}
          />
          <Stat label={t('toolsCalc.bmi.prime')} value={formatFixed(result.bmi / 25, 2, i18n.language)} hint={t('toolsCalc.bmi.prime_hint')} />
        </div>
      )}
      {result && <div><CopyButton text={`BMI ${bmiText} (${t(`toolsCalc.bmi.band_${result.band}`)})`} label={t('toolsCalc.common.copy')}>{t('toolsCalc.common.copy')}</CopyButton></div>}
    </Bench>
  );
};

export default BmiWorkbench;
