/** Case converter: one live input, one result card per naming style; click a card to copy it. */
import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CASE_STYLE_IDS, convertCaseText, type CaseStyleId } from './convertOps';
import { ConvertPage, PANEL_CLASS, prefillOf, StatChip, TextPane, useConvertT, useCopy, useDebouncedRecord, useRecorder } from './convertKit';

interface CaseInput {
  text: string;
}

const SAMPLE_KEYS = ['sample_a', 'sample_b', 'sample_c'] as const;

const CaseConverterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<CaseInput>(lastRun);
  const [text, setText] = useState(prefill.text ?? '');
  const { copied, copy } = useCopy();
  const record = useRecorder(tool.id, variant);

  const results = useMemo(() => CASE_STYLE_IDS.map((id) => ({ id, value: convertCaseText(text, id) })), [text]);
  const lineCount = text ? text.split(/\r?\n/).length : 0;

  useDebouncedRecord(tool.id, variant, { text }, results[0].value, Boolean(text));

  const copyResult = async (id: CaseStyleId, value: string): Promise<void> => {
    if (await copy(value, id)) record({ text, style: id }, value);
  };

  return (
    <ConvertPage>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-2">
          <TextPane
            label={tc('case.input')}
            value={text}
            onChange={setText}
            placeholder={tc('case.placeholder')}
            rows={8}
            footer={(
              <>
                {text && <StatChip>{lineCount > 1 ? tc('case.lines', { count: lineCount }) : tc('case.chars', { count: text.length })}</StatChip>}
                {SAMPLE_KEYS.map((key) => (
                  <button key={key} type="button" onClick={() => setText(tc(`case.${key}`))} className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-white/10 dark:text-slate-400 dark:hover:text-sky-300">
                    {tc(`case.${key}`)}
                  </button>
                ))}
              </>
            )}
          />
          <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{tc('case.per_line_hint')}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {results.map(({ id, value }) => (
            <button
              key={id}
              type="button"
              disabled={!value}
              onClick={() => copyResult(id, value)}
              className={`${PANEL_CLASS} group flex min-w-0 flex-col items-start gap-1 p-3 text-left transition hover:border-sky-400 disabled:cursor-default disabled:opacity-60 dark:hover:border-sky-500/60`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tc(`case.style_${id}`)}
                {copied === id && <Check className="h-3.5 w-3.5 text-emerald-500" />}
              </span>
              <span className="w-full whitespace-pre-wrap break-all font-mono text-[13px] text-slate-900 dark:text-slate-100">{value || ' '}</span>
            </button>
          ))}
        </div>
      </div>
    </ConvertPage>
  );
};

export default CaseConverterWorkbench;
