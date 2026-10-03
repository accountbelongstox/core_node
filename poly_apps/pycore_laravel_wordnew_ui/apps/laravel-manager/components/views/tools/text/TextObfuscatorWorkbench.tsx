/** Text obfuscator: method cards with live previews, reversible direction and a shift slider for ROT. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpFromLine } from 'lucide-react';
import { RangeField } from '@/shared/ui/RangeField';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperTextarea, Segmented, SoftButton, prefillNumber, prefillOneOf, prefillString, useToolRecord } from './textKit';
import { OBFUSCATE_METHODS, REVERSIBLE, deobfuscate, obfuscate, type ObfuscateMethod } from './logic/obfuscateLogic';

const DIRECTIONS = ['obfuscate', 'restore'] as const;
type Direction = (typeof DIRECTIONS)[number];
const PREVIEW_CHARS = 28;
const SHIFT_RANGE = { min: 1, max: 25, fallback: 13 };

const run = (text: string, method: ObfuscateMethod, shift: number, direction: Direction): { value: string; failed: boolean } => {
  try {
    return { value: direction === 'obfuscate' ? obfuscate(text, method, shift) : deobfuscate(text, method, shift), failed: false };
  } catch {
    return { value: '', failed: true };
  }
};

const TextObfuscatorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [text, setText] = useState(() => prefillString(lastRun, 'text', 'Meet me at the usual place at 9pm.'));
  const [method, setMethod] = useState<ObfuscateMethod>(() => prefillOneOf(lastRun, 'method', OBFUSCATE_METHODS, 'unicode'));
  const [direction, setDirection] = useState<Direction>(() => prefillOneOf(lastRun, 'direction', DIRECTIONS, 'obfuscate'));
  const [shift, setShift] = useState(() => prefillNumber(lastRun, 'shift', SHIFT_RANGE.fallback));

  const effectiveDirection: Direction = REVERSIBLE[method] ? direction : 'obfuscate';
  const output = useMemo(() => run(text, method, shift, effectiveDirection), [text, method, shift, effectiveDirection]);
  const previews = useMemo(() => OBFUSCATE_METHODS.map((id) => ({ id, sample: run(text.slice(0, 10), id, shift, 'obfuscate').value })), [text, shift]);
  const delta = output.value.length - text.length;

  return (
    <Desk wide>
      <Paper title={t('toolsText.obfuscate.method')} actions={REVERSIBLE[method] ? <Segmented value={direction} onChange={setDirection} ariaLabel={t('toolsText.obfuscate.direction')} options={DIRECTIONS.map((id) => ({ value: id, label: t(`toolsText.obfuscate.dir_${id}`) }))} /> : undefined}>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label={t('toolsText.obfuscate.method')}>
          {previews.map(({ id, sample }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={method === id}
              onClick={() => setMethod(id)}
              className={`min-w-0 cursor-pointer rounded-xl border p-2.5 text-left transition-colors ${method === id ? 'border-violet-500 bg-violet-600 text-white' : 'border-stone-200 bg-white hover:border-violet-300 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:border-violet-500/60'}`}
            >
              <span className="block text-sm font-bold">{t(`toolsText.obfuscate.m_${id}`)}</span>
              <span className={`mt-1 block truncate font-mono text-[10px] ${method === id ? 'text-violet-100' : 'text-slate-400'}`}>{sample.slice(0, PREVIEW_CHARS) || '-'}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t(`toolsText.obfuscate.hint_${method}`)}</p>
        {method === 'rot' && (
          <div className="mt-3 max-w-sm">
            <FieldLabel hint={String(shift)}>{t('toolsText.obfuscate.shift')}</FieldLabel>
            <RangeField value={shift} min={SHIFT_RANGE.min} max={SHIFT_RANGE.max} step={1} onChange={setShift} />
          </div>
        )}
      </Paper>

      <div className="grid gap-4 lg:grid-cols-2">
        <Paper title={t(effectiveDirection === 'obfuscate' ? 'toolsText.obfuscate.plain' : 'toolsText.obfuscate.encoded')}>
          <PaperTextarea mono rows={9} value={text} onChange={setText} ariaLabel={t('uiTools.common.input')} placeholder={t('toolsText.obfuscate.placeholder')} />
        </Paper>
        <Paper
          title={t(effectiveDirection === 'obfuscate' ? 'toolsText.obfuscate.encoded' : 'toolsText.obfuscate.plain')}
          actions={(
            <>
              <SoftButton icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} disabled={!output.value} onClick={() => setText(output.value)}>{t('toolsText.obfuscate.use_as_input')}</SoftButton>
              <CopyButton text={output.value} onCopied={() => record({ text, method, direction: effectiveDirection, shift }, { length: output.value.length })} />
            </>
          )}
        >
          {output.failed ? <Notice tone="error">{t('toolsText.obfuscate.cannot_restore')}</Notice> : <PaperTextarea readOnly mono rows={9} value={output.value} onChange={() => undefined} ariaLabel={t('toolsText.obfuscate.output')} />}
          <p className="mt-2 text-[11px] text-slate-400">{t('toolsText.obfuscate.size', { from: text.length, to: output.value.length, delta: `${delta >= 0 ? '+' : ''}${delta}` })}</p>
        </Paper>
      </div>
    </Desk>
  );
};

export default TextObfuscatorWorkbench;
