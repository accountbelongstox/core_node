/** Loan EMI calculator: sliders, principal/interest split bar, balance chart and amortization table. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, CurrencySelect, Lcd, MUTED_TEXT, Seg, Slider, Stat, asCurrency, moneyFormat, prefillInput, useAccent, useAutoRecord, useRecordUse, type CurrencyCode } from './calcKit';
import { calculateLoan, type LoanRow } from './mathLogic';

type TenureUnit = 'years' | 'months';
type TableView = 'yearly' | 'monthly';

const MONTHS_PER_YEAR = 12;
const CHART = { width: 100, height: 36 };

interface YearRow { year: number; principal: number; interest: number; payment: number; balance: number }

const aggregateYears = (rows: readonly LoanRow[]): YearRow[] => {
  const out: YearRow[] = [];
  rows.forEach((row) => {
    const year = Math.ceil(row.month / MONTHS_PER_YEAR);
    const last = out[out.length - 1];
    if (last && last.year === year) {
      last.principal += row.principal; last.interest += row.interest; last.payment += row.payment; last.balance = row.balance;
    } else {
      out.push({ year, principal: row.principal, interest: row.interest, payment: row.payment, balance: row.balance });
    }
  });
  return out;
};

const LoanEmiWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { principal: 250000, rate: 7.5, tenure: 20, tenureUnit: 'years', currency: 'USD' }), [lastRun]);
  const [principal, setPrincipal] = useState(initial.principal);
  const [rate, setRate] = useState(initial.rate);
  const [tenure, setTenure] = useState(initial.tenure);
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>(initial.tenureUnit === 'months' ? 'months' : 'years');
  const [currency, setCurrency] = useState<CurrencyCode>(asCurrency(initial.currency));
  const [view, setView] = useState<TableView>('yearly');

  const months = tenureUnit === 'years' ? tenure * MONTHS_PER_YEAR : tenure;
  const loan = useMemo(() => calculateLoan(principal, rate, months), [principal, rate, months]);
  const yearly = useMemo(() => (loan ? aggregateYears(loan.schedule) : []), [loan]);
  const money = useMemo(() => moneyFormat(i18n.language, currency), [i18n.language, currency]);
  const interestShare = loan ? (loan.totalInterest / loan.totalPayment) * 100 : 0;

  const chart = useMemo(() => {
    if (!loan) return null;
    const n = loan.schedule.length;
    const maxValue = Math.max(principal, loan.totalInterest);
    let cumulative = 0;
    const x = (i: number): number => (n > 1 ? (i / (n - 1)) * CHART.width : 0);
    const y = (v: number): number => CHART.height - (v / maxValue) * CHART.height;
    const balance = loan.schedule.map((row, i) => `${x(i).toFixed(2)},${y(row.balance).toFixed(2)}`);
    const interest = loan.schedule.map((row, i) => { cumulative += row.interest; return `${x(i).toFixed(2)},${y(cumulative).toFixed(2)}`; });
    return { balance: balance.join(' '), interest: interest.join(' '), area: `0,${CHART.height} ${balance.join(' ')} ${CHART.width},${CHART.height}` };
  }, [loan, principal]);

  useAutoRecord(record, { principal, rate, tenure, tenureUnit, currency }, { emi: loan?.emi ?? 0, totalInterest: loan?.totalInterest ?? 0 }, loan !== null);

  const cell = 'px-3 py-1.5 text-right font-mono text-xs tabular-nums';

  return (
    <Bench accent="math">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card
          title={t('toolsCalc.loan.terms')}
          icon={<Landmark className="h-3.5 w-3.5" />}
          aside={<CurrencySelect value={currency} onChange={setCurrency} label={t('toolsCalc.loan.currency')} />}
        >
          <div className="space-y-5">
            <Slider label={t('toolsCalc.loan.principal')} value={principal} min={1000} max={10000000} step={1000} onChange={setPrincipal} />
            <Slider label={t('toolsCalc.loan.rate')} value={rate} min={0} max={30} step={0.05} onChange={setRate} suffix="%" />
            <div>
              <div className="mb-2 flex justify-end">
                <Seg
                  value={tenureUnit}
                  onChange={(next) => { setTenureUnit(next); setTenure(next === 'years' ? Math.max(1, Math.round(tenure / MONTHS_PER_YEAR)) : tenure * MONTHS_PER_YEAR); }}
                  ariaLabel={t('toolsCalc.loan.tenure_unit')}
                  options={[{ value: 'years', label: t('toolsCalc.loan.years') }, { value: 'months', label: t('toolsCalc.loan.months') }]}
                />
              </div>
              {tenureUnit === 'years'
                ? <Slider label={t('toolsCalc.loan.tenure')} value={tenure} min={1} max={40} step={1} onChange={setTenure} suffix={` ${t('toolsCalc.loan.years_short')}`} />
                : <Slider label={t('toolsCalc.loan.tenure')} value={tenure} min={1} max={480} step={1} onChange={setTenure} suffix={` ${t('toolsCalc.loan.months_short')}`} />}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Lcd className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider opacity-60">{t('toolsCalc.loan.emi')}</p>
            <p className="break-all text-4xl font-bold sm:text-5xl">{loan ? money.format(loan.emi) : '—'}</p>
            <p className="text-xs opacity-70">{t('toolsCalc.loan.per_month')}</p>
          </Lcd>
          {loan && (
            <Card>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`${a.bar} h-full transition-[width] duration-300`} style={{ width: `${100 - interestShare}%` }} />
                <div className="h-full bg-sky-400 transition-[width] duration-300" style={{ width: `${interestShare}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${a.bar}`} />{t('toolsCalc.loan.principal')} {(100 - interestShare).toFixed(1)}%</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-400" />{t('toolsCalc.loan.interest')} {interestShare.toFixed(1)}%</span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {loan && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label={t('toolsCalc.loan.total_interest')} value={money.format(loan.totalInterest)} />
            <Stat label={t('toolsCalc.loan.total_payment')} value={money.format(loan.totalPayment)} />
            <Stat label={t('toolsCalc.loan.payments')} value={loan.schedule.length} />
          </div>

          {chart && (
            <Card title={t('toolsCalc.loan.chart')} aside={(
              <span className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1"><i className={`h-0.5 w-4 ${a.bar}`} />{t('toolsCalc.loan.balance')}</span>
                <span className="inline-flex items-center gap-1"><i className="h-0.5 w-4 bg-sky-400" />{t('toolsCalc.loan.cumulative_interest')}</span>
              </span>
            )}>
              <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label={t('toolsCalc.loan.chart')}>
                <polygon points={chart.area} className="fill-orange-500/15" />
                <polyline points={chart.balance} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="2" className="stroke-orange-500" />
                <polyline points={chart.interest} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="2" className="stroke-sky-400" />
              </svg>
            </Card>
          )}

          <Card
            title={t('toolsCalc.loan.schedule')}
            aside={(
              <div className="flex items-center gap-2">
                <Seg value={view} onChange={setView} ariaLabel={t('toolsCalc.loan.schedule')} options={[{ value: 'yearly', label: t('toolsCalc.loan.yearly') }, { value: 'monthly', label: t('toolsCalc.loan.monthly') }]} />
                <CopyButton
                  label={t('toolsCalc.common.copy')}
                  text={() => ['#\tprincipal\tinterest\tpayment\tbalance', ...(view === 'yearly' ? yearly.map((r) => [r.year, r.principal, r.interest, r.payment, r.balance]) : loan.schedule.map((r) => [r.month, r.principal, r.interest, r.payment, r.balance])).map((r) => r.map((v, i) => (i === 0 ? v : Number(v).toFixed(2))).join('\t'))].join('\n')}
                />
              </div>
            )}
          >
            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[460px] border-collapse">
                <thead className={`sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider dark:bg-slate-900 ${MUTED_TEXT}`}>
                  <tr>
                    <th className="px-3 py-2 text-left">{view === 'yearly' ? t('toolsCalc.loan.year') : t('toolsCalc.loan.month')}</th>
                    <th className="px-3 py-2 text-right">{t('toolsCalc.loan.principal')}</th>
                    <th className="px-3 py-2 text-right">{t('toolsCalc.loan.interest')}</th>
                    <th className="px-3 py-2 text-right">{t('toolsCalc.loan.payment')}</th>
                    <th className="px-3 py-2 text-right">{t('toolsCalc.loan.balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                  {(view === 'yearly'
                    ? yearly.map((r) => ({ key: r.year, ...r }))
                    : loan.schedule.map((r) => ({ key: r.month, year: r.month, ...r }))
                  ).map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 font-mono text-xs font-bold">{r.key}</td>
                      <td className={cell}>{money.format(r.principal)}</td>
                      <td className={cell}>{money.format(r.interest)}</td>
                      <td className={cell}>{money.format(r.payment)}</td>
                      <td className={cell}>{money.format(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Bench>
  );
};

export default LoanEmiWorkbench;
