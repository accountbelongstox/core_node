/** GST / VAT calculator: add tax to a net price or extract it from a gross price, shown as an invoice. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, Chips, CopyButton, CurrencySelect, FieldLabel, MUTED_TEXT, NumField, Seg, Switch2, asCurrency, moneyFormat, prefillInput, useAccent, useAutoRecord, useRecordUse, type CurrencyCode } from './calcKit';
import { calculateGst, type GstMode } from './mathLogic';

const RATE_PRESETS = [5, 10, 12, 18, 20, 28] as const;
const HALF = 2;

const GstWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { amount: 1000, rate: 18, mode: 'exclusive', split: false, currency: 'USD' }), [lastRun]);
  const [amount, setAmount] = useState(initial.amount);
  const [rate, setRate] = useState(initial.rate);
  const [mode, setMode] = useState<GstMode>(initial.mode === 'inclusive' ? 'inclusive' : 'exclusive');
  const [split, setSplit] = useState(initial.split);
  const [currency, setCurrency] = useState<CurrencyCode>(asCurrency(initial.currency));

  const result = useMemo(() => calculateGst(amount, rate, mode), [amount, rate, mode]);
  const money = useMemo(() => moneyFormat(i18n.language, currency), [i18n.language, currency]);
  const taxShare = result && result.total > 0 ? (result.tax / result.total) * 100 : 0;
  const rateLabel = `${rate}%`;

  useAutoRecord(record, { amount, rate, mode, split, currency }, { net: result?.net ?? 0, tax: result?.tax ?? 0, total: result?.total ?? 0 }, result !== null);

  const lines: Array<{ key: string; label: string; value: number; strong?: boolean; accent?: boolean }> = result ? [
    { key: 'net', label: t('toolsCalc.gst.net'), value: result.net },
    ...(split
      ? [
        { key: 'cgst', label: `${t('toolsCalc.gst.cgst')} (${rate / HALF}%)`, value: result.tax / HALF, accent: true },
        { key: 'sgst', label: `${t('toolsCalc.gst.sgst')} (${rate / HALF}%)`, value: result.tax / HALF, accent: true },
      ]
      : [{ key: 'tax', label: `${t('toolsCalc.gst.tax')} (${rateLabel})`, value: result.tax, accent: true }]),
    { key: 'total', label: t('toolsCalc.gst.total'), value: result.total, strong: true },
  ] : [];

  return (
    <Bench accent="math">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t('toolsCalc.gst.inputs')} icon={<Receipt className="h-3.5 w-3.5" />} aside={<CurrencySelect value={currency} onChange={setCurrency} label={t('toolsCalc.gst.currency')} />}>
          <div className="space-y-4">
            <Seg
              value={mode}
              onChange={setMode}
              ariaLabel={t('toolsCalc.gst.mode')}
              options={[{ value: 'exclusive', label: t('toolsCalc.gst.exclusive') }, { value: 'inclusive', label: t('toolsCalc.gst.inclusive') }]}
            />
            <div>
              <FieldLabel>{mode === 'exclusive' ? t('toolsCalc.gst.amount_net') : t('toolsCalc.gst.amount_gross')}</FieldLabel>
              <NumField value={amount} onChange={setAmount} ariaLabel={t('toolsCalc.gst.amount')} inputClassName="py-3 text-2xl font-bold" />
            </div>
            <div>
              <FieldLabel>{t('toolsCalc.gst.rate')}</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Chips value={RATE_PRESETS.includes(rate as typeof RATE_PRESETS[number]) ? rate : null} onChange={setRate} options={RATE_PRESETS.map((r) => ({ value: r, label: `${r}%` }))} />
                <NumField value={rate} onChange={setRate} min={0} max={100} ariaLabel={t('toolsCalc.gst.rate')} suffix="%" className="w-24" inputClassName="py-1" />
              </div>
            </div>
            <Switch2 on={split} onChange={setSplit} label={t('toolsCalc.gst.split')} />
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="font-mono">
            <p className={`mb-3 text-center text-[11px] font-bold uppercase tracking-[0.3em] ${MUTED_TEXT}`}>{t('toolsCalc.gst.invoice')}</p>
            {result ? (
              <ul className="space-y-0">
                {lines.map((line) => (
                  <li key={line.key} className={`flex items-baseline justify-between gap-3 border-b border-dashed border-slate-300 py-2 dark:border-slate-700 ${line.strong ? 'border-b-0 border-t-2 border-solid border-t-slate-800 pt-3 dark:border-t-slate-200' : ''}`}>
                    <span className={`text-xs ${line.accent ? a.text : MUTED_TEXT} ${line.strong ? 'font-bold uppercase text-slate-900 dark:text-white' : ''}`}>{line.label}</span>
                    <span className={`break-all text-right tabular-nums ${line.strong ? 'text-2xl font-black text-slate-900 dark:text-white' : 'text-sm font-semibold text-slate-800 dark:text-slate-100'}`}>{money.format(line.value)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className={`py-8 text-center text-xs ${MUTED_TEXT}`}>{t('toolsCalc.gst.need_values')}</p>}
          </div>
          {result && (
            <div className="mt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-slate-400 transition-[width] duration-300 dark:bg-slate-500" style={{ width: `${100 - taxShare}%` }} />
                <div className={`h-full ${a.bar} transition-[width] duration-300`} style={{ width: `${taxShare}%` }} />
              </div>
              <div className={`mt-1.5 flex justify-between text-[11px] ${MUTED_TEXT}`}>
                <span>{t('toolsCalc.gst.net')} {(100 - taxShare).toFixed(1)}%</span>
                <span>{t('toolsCalc.gst.tax')} {taxShare.toFixed(1)}%</span>
              </div>
              <div className="mt-3 flex justify-end">
                <CopyButton text={`${money.format(result.net)} + ${money.format(result.tax)} = ${money.format(result.total)}`} label={t('toolsCalc.common.copy')}>{t('toolsCalc.common.copy')}</CopyButton>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Bench>
  );
};

export default GstWorkbench;
