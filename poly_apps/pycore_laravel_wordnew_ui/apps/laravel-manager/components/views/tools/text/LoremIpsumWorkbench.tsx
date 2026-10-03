/** Lorem ipsum generator: unit and count steppers beside a live paper-page preview. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dices } from 'lucide-react';
import { Stepper } from '@/shared/ui/Stepper';
import { RangeField } from '@/shared/ui/RangeField';
import { Switch } from '@/shared/ui/Switch';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Paper, Segmented, SoftButton, prefillBool, prefillNumber, prefillOneOf, useToolRecord } from './textKit';
import { generateLorem, joinLorem, type LoremUnit } from './logic/loremLogic';

const UNITS: readonly LoremUnit[] = ['paragraphs', 'sentences', 'words'];
const LIMITS: Record<LoremUnit, { min: number; max: number; step: number; fallback: number }> = {
  paragraphs: { min: 1, max: 30, step: 1, fallback: 3 },
  sentences: { min: 1, max: 60, step: 1, fallback: 5 },
  words: { min: 1, max: 500, step: 5, fallback: 50 },
};

const LoremIpsumWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [unit, setUnit] = useState<LoremUnit>(() => prefillOneOf(lastRun, 'unit', UNITS, 'paragraphs'));
  const [count, setCount] = useState(() => prefillNumber(lastRun, 'count', LIMITS[prefillOneOf(lastRun, 'unit', UNITS, 'paragraphs')].fallback));
  const [startWithLorem, setStartWithLorem] = useState(() => prefillBool(lastRun, 'startWithLorem', true));
  const [html, setHtml] = useState(() => prefillBool(lastRun, 'html', false));
  const [seed, setSeed] = useState(0);

  const limits = LIMITS[unit];
  const paragraphs = useMemo(() => generateLorem(unit, Math.min(count, limits.max), startWithLorem), [unit, count, startWithLorem, seed, limits.max]);
  const output = joinLorem(paragraphs, html);
  const words = output.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

  const changeUnit = (next: LoremUnit): void => {
    setUnit(next);
    setCount(LIMITS[next].fallback);
  };

  return (
    <Desk>
      <div className="grid gap-4 lg:grid-cols-3">
        <Paper title={t('toolsText.lorem.settings')} className="lg:col-span-1 lg:self-start">
          <div className="space-y-5">
            <div>
              <FieldLabel>{t('toolsText.lorem.unit')}</FieldLabel>
              <Segmented value={unit} onChange={changeUnit} ariaLabel={t('toolsText.lorem.unit')} options={UNITS.map((id) => ({ value: id, label: t(`toolsText.lorem.unit_${id}`) }))} />
            </div>
            <div>
              <FieldLabel>{t('toolsText.lorem.count')}</FieldLabel>
              <div className="flex items-center justify-between gap-3">
                <Stepper value={count} min={limits.min} max={limits.max} step={limits.step} onChange={setCount} />
              </div>
              <RangeField className="mt-3" value={count} min={limits.min} max={limits.max} step={1} onChange={setCount} />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
              {t('toolsText.lorem.start_with')}
              <Switch on={startWithLorem} onChange={setStartWithLorem} label={t('toolsText.lorem.start_with')} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
              {t('toolsText.lorem.html')}
              <Switch on={html} onChange={setHtml} label={t('toolsText.lorem.html')} />
            </label>
          </div>
        </Paper>

        <Paper
          className="lg:col-span-2"
          title={t('toolsText.lorem.preview')}
          actions={(
            <>
              <SoftButton icon={<Dices className="h-3.5 w-3.5" />} onClick={() => setSeed((value) => value + 1)}>{t('toolsText.lorem.regenerate')}</SoftButton>
              <CopyButton text={output} onCopied={() => record({ unit, count, startWithLorem, html }, { words })} />
            </>
          )}
        >
          <article className="mx-auto max-w-prose space-y-4 rounded-xl border border-stone-200 bg-[#fffdf8] px-5 py-6 font-serif text-base leading-8 text-slate-800 shadow-inner dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-200 sm:px-8">
            {html ? <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6">{output}</pre> : paragraphs.map((text, index) => <p key={index}>{text}</p>)}
          </article>
          <p className="mt-3 text-center text-[11px] text-slate-400">{t('toolsText.lorem.summary', { words, chars: output.length })}</p>
        </Paper>
      </div>
    </Desk>
  );
};

export default LoremIpsumWorkbench;
