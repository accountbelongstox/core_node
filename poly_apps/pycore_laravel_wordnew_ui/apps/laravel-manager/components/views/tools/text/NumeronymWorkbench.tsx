/** Numeronym generator: live word-by-word conversion with a minimum-length stepper and famous examples. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stepper } from '@/shared/ui/Stepper';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Paper, PaperTextarea, SoftButton, prefillNumber, prefillString, useToolRecord } from './textKit';
import { FAMOUS_NUMERONYMS, convertText } from './logic/numeronymLogic';

const MIN_LENGTH_RANGE = { min: 4, max: 20 };

const NumeronymWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [text, setText] = useState(() => prefillString(lastRun, 'text', 'internationalization and localization improve accessibility'));
  const [minLength, setMinLength] = useState(() => prefillNumber(lastRun, 'minLength', MIN_LENGTH_RANGE.min));

  const tokens = useMemo(() => convertText(text, minLength), [text, minLength]);
  const output = tokens.map((token) => token.numeronym).join('');
  const converted = tokens.filter((token) => token.isWord && token.numeronym !== token.text);

  return (
    <Desk>
      <Paper title={t('toolsText.numeronym.source')}>
        <PaperTextarea serif rows={3} value={text} onChange={setText} ariaLabel={t('toolsText.numeronym.source')} placeholder={t('toolsText.numeronym.placeholder')} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FieldLabel>{t('toolsText.numeronym.min_length')}</FieldLabel>
            <Stepper value={minLength} min={MIN_LENGTH_RANGE.min} max={MIN_LENGTH_RANGE.max} step={1} onChange={setMinLength} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FAMOUS_NUMERONYMS.slice(0, 5).map((entry) => (
              <SoftButton key={entry.numeronym} onClick={() => setText(entry.word)} title={entry.word}><span className="font-mono">{entry.word}</span></SoftButton>
            ))}
          </div>
        </div>
      </Paper>

      <Paper title={t('toolsText.numeronym.result')} actions={<CopyButton text={output} onCopied={() => record({ text, minLength }, { numeronym: output })} />}>
        <p className="min-h-[3.5rem] break-words rounded-xl bg-violet-50/70 px-4 py-4 font-mono text-2xl font-black leading-snug text-violet-700 dark:bg-violet-500/10 dark:text-violet-200 sm:text-3xl" aria-live="polite">
          {tokens.map((token, index) => (token.isWord && token.numeronym !== token.text
            ? <span key={index} className="rounded-md bg-violet-200/70 px-1 dark:bg-violet-500/30">{token.numeronym}</span>
            : <span key={index} className="text-slate-400 dark:text-slate-500">{token.numeronym}</span>))}
        </p>
        {converted.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {converted.map((token, index) => (
              <li key={`${token.text}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                <span className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">{token.text}</span>
                <span className="shrink-0 font-mono text-sm font-black text-violet-600 dark:text-violet-300">{token.numeronym}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-sm text-slate-400">{t('toolsText.numeronym.nothing')}</p>
        )}
      </Paper>

      <Paper title={t('toolsText.numeronym.famous')}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FAMOUS_NUMERONYMS.map((entry) => (
            <li key={entry.numeronym}>
              <button type="button" onClick={() => setText(entry.word)} className="w-full cursor-pointer rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-violet-300 dark:border-slate-700/60 dark:hover:border-violet-500/60">
                <span className="block font-mono text-base font-black text-violet-600 dark:text-violet-300">{entry.numeronym}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{entry.word}</span>
              </button>
            </li>
          ))}
        </ul>
      </Paper>
    </Desk>
  );
};

export default NumeronymWorkbench;
