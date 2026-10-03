/** Number to words: English and Chinese spelling (plain, ordinal, financial, currency) of arbitrarily large numbers. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, Lcd, MUTED_TEXT, Notice, Seg, Switch2, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { groupDigits, numberToWords, type WordsCurrency, type WordsLang, type WordsOptions } from './mathLogic';

type EnStyle = 'plain' | 'ordinal' | 'currency';
type ZhStyle = 'plain' | 'financial' | 'currency';

const EN_STYLES: readonly EnStyle[] = ['plain', 'ordinal', 'currency'];
const ZH_STYLES: readonly ZhStyle[] = ['plain', 'financial', 'currency'];
const CURRENCIES: readonly WordsCurrency[] = ['USD', 'EUR', 'GBP', 'CNY'];
const EXAMPLES = ['1234567.89', '100', '2026', '0.5', '1000000000'];

const NumberToWordsWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { value: '1234567.89', lang: 'en', enStyle: 'plain', zhStyle: 'plain', currency: 'USD', british: false }), [lastRun]);
  const [value, setValue] = useState(initial.value);
  const [lang, setLang] = useState<WordsLang>(initial.lang === 'zh' ? 'zh' : 'en');
  const [enStyle, setEnStyle] = useState<EnStyle>(EN_STYLES.includes(initial.enStyle as EnStyle) ? (initial.enStyle as EnStyle) : 'plain');
  const [zhStyle, setZhStyle] = useState<ZhStyle>(ZH_STYLES.includes(initial.zhStyle as ZhStyle) ? (initial.zhStyle as ZhStyle) : 'plain');
  const [currency, setCurrency] = useState<WordsCurrency>(CURRENCIES.includes(initial.currency as WordsCurrency) ? (initial.currency as WordsCurrency) : 'USD');
  const [british, setBritish] = useState(initial.british);

  const options: WordsOptions = useMemo(() => (lang === 'en'
    ? { lang, style: enStyle, currency, british, financial: false }
    : { lang, style: zhStyle === 'currency' ? 'currency' : 'plain', currency: 'CNY', british: false, financial: zhStyle === 'financial' }), [lang, enStyle, zhStyle, currency, british]);
  const result = useMemo(() => numberToWords(value, options), [value, options]);
  const grouped = useMemo(() => {
    const cleaned = value.trim().replace(/[,_\s]/g, '');
    return /^[+-]?\d*\.?\d*$/.test(cleaned) && /\d/.test(cleaned) ? groupDigits(cleaned) : '';
  }, [value]);

  useAutoRecord(record, { value, lang, enStyle, zhStyle, currency, british }, { text: result.ok ? result.text : '' }, result.ok);

  return (
    <Bench accent="math">
      <Card>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="n2w-input">{t('toolsCalc.words.number')}</FieldLabel>
            <input
              id="n2w-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('toolsCalc.words.placeholder')}
              className={`${FIELD_CLASS} ${a.focus} py-3 text-2xl font-bold`}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Chips value={null} onChange={setValue} options={EXAMPLES.map((example) => ({ value: example, label: groupDigits(example) }))} />
              {grouped && <span className={`font-mono text-xs ${MUTED_TEXT}`}>{grouped}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Seg value={lang} onChange={setLang} ariaLabel={t('toolsCalc.words.language')} options={[{ value: 'en', label: 'English' }, { value: 'zh', label: '中文' }]} />
            {lang === 'en'
              ? <Seg value={enStyle} onChange={setEnStyle} ariaLabel={t('toolsCalc.words.style')} options={EN_STYLES.map((s) => ({ value: s, label: t(`toolsCalc.words.en_${s}`) }))} />
              : <Seg value={zhStyle} onChange={setZhStyle} ariaLabel={t('toolsCalc.words.style')} options={ZH_STYLES.map((s) => ({ value: s, label: t(`toolsCalc.words.zh_${s}`) }))} />}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {lang === 'en' && enStyle === 'currency' && (
              <Seg value={currency} onChange={setCurrency} ariaLabel={t('toolsCalc.words.currency')} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            )}
            {lang === 'en' && enStyle !== 'ordinal' && <Switch2 on={british} onChange={setBritish} label={t('toolsCalc.words.british')} />}
          </div>
        </div>
      </Card>

      <Lcd className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider opacity-60">
          <span>{t('toolsCalc.words.result')}</span>
          {result.ok && <CopyButton text={result.text} label={t('toolsCalc.common.copy')} className="!text-orange-200 hover:!bg-white/10">{t('toolsCalc.common.copy')}</CopyButton>}
        </div>
        {result.ok ? (
          <p lang={lang} className={`break-words text-2xl font-semibold leading-snug sm:text-3xl ${lang === 'zh' ? 'tracking-wide' : 'first-letter:uppercase'}`}>{result.text}</p>
        ) : (
          <p className="text-sm opacity-60">{result.error === 'empty' ? t('toolsCalc.words.empty') : null}</p>
        )}
      </Lcd>
      {!result.ok && result.error !== 'empty' && <Notice>{t(`toolsCalc.words.errors.${result.error}`)}</Notice>}
    </Bench>
  );
};

export default NumberToWordsWorkbench;
