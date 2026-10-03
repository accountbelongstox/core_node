/** Text diff: two editors and a split or unified diff with line and word level highlighting. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Eraser } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperTextarea, Segmented, SoftButton, Tile, ToggleChip, prefillBool, prefillOneOf, prefillString, useDebounced, useToolRecord } from './textKit';
import { computeDiff, type SplitRow, type UnifiedRow, type WordPart } from './logic/diffLogic';

const DEBOUNCE_MS = 150;
const ROW_LIMIT = 1500;
const CONTEXT_LINES = 2;
const VIEWS = ['split', 'unified'] as const;
type View = (typeof VIEWS)[number];

const SAMPLE_LEFT = 'The quick brown fox\njumps over the lazy dog.\nThis line stays the same.\nRemove me please.\nLast line';
const SAMPLE_RIGHT = 'The quick red fox\njumps over the lazy cat.\nThis line stays the same.\nA brand new line appears here.\nLast line';

type Item<T> = { kind: 'row'; row: T } | { kind: 'skip'; count: number };

const collapse = <T,>(rows: T[], isEqual: (row: T) => boolean, enabled: boolean): Item<T>[] => {
  if (!enabled) return rows.map((row) => ({ kind: 'row', row }));
  const keep = rows.map(() => false);
  rows.forEach((row, index) => {
    if (isEqual(row)) return;
    for (let i = Math.max(0, index - CONTEXT_LINES); i <= Math.min(rows.length - 1, index + CONTEXT_LINES); i += 1) keep[i] = true;
  });
  const items: Item<T>[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    if (keep[index]) {
      if (skipped) { items.push({ kind: 'skip', count: skipped }); skipped = 0; }
      items.push({ kind: 'row', row });
    } else skipped += 1;
  });
  if (skipped) items.push({ kind: 'skip', count: skipped });
  return items;
};

const Words: React.FC<{ parts?: WordPart[]; text: string; tone: 'del' | 'ins' }> = ({ parts, text, tone }) => {
  if (!parts) return <>{text || ' '}</>;
  const mark = tone === 'del' ? 'bg-rose-300/70 dark:bg-rose-500/40' : 'bg-emerald-300/70 dark:bg-emerald-500/40';
  return <>{parts.map((part, index) => (part.changed ? <mark key={index} className={`rounded-sm text-inherit ${mark}`}>{part.text}</mark> : <span key={index}>{part.text}</span>))}</>;
};

const CELL = 'min-w-0 whitespace-pre-wrap break-words px-2 py-0.5 font-mono text-xs leading-5';
const NUM = 'select-none px-1.5 py-0.5 text-right font-mono text-[10px] leading-5 text-slate-400';
const DEL_BG = 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100';
const INS_BG = 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100';
const EMPTY_BG = 'bg-stone-50 dark:bg-slate-800/40';

const SplitView: React.FC<{ items: Item<SplitRow>[]; skipLabel: (n: number) => string }> = ({ items, skipLabel }) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-slate-700/60">
    {items.map((item, index) => {
      if (item.kind === 'skip') return <div key={index} className="bg-violet-50 px-3 py-1 text-center text-[11px] text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">{skipLabel(item.count)}</div>;
      const { row } = item;
      const left = row.kind === 'delete' || row.kind === 'change';
      const right = row.kind === 'insert' || row.kind === 'change';
      return (
        <div key={index} className="grid grid-cols-2 border-b border-stone-100 last:border-b-0 dark:border-slate-800">
          <div className="grid min-w-0 grid-cols-[2rem_1fr] border-r border-stone-100 dark:border-slate-800">
            <span className={`${NUM} ${left ? DEL_BG : EMPTY_BG}`}>{row.aNumber ?? ''}</span>
            <span className={`${CELL} ${left ? DEL_BG : row.kind === 'equal' ? '' : EMPTY_BG}`}><Words parts={row.aParts} text={row.aText} tone="del" /></span>
          </div>
          <div className="grid min-w-0 grid-cols-[2rem_1fr]">
            <span className={`${NUM} ${right ? INS_BG : EMPTY_BG}`}>{row.bNumber ?? ''}</span>
            <span className={`${CELL} ${right ? INS_BG : row.kind === 'equal' ? '' : EMPTY_BG}`}><Words parts={row.bParts} text={row.bText} tone="ins" /></span>
          </div>
        </div>
      );
    })}
  </div>
);

const UnifiedView: React.FC<{ items: Item<UnifiedRow>[]; skipLabel: (n: number) => string }> = ({ items, skipLabel }) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-slate-700/60">
    {items.map((item, index) => {
      if (item.kind === 'skip') return <div key={index} className="bg-violet-50 px-3 py-1 text-center text-[11px] text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">{skipLabel(item.count)}</div>;
      const { row } = item;
      const tone = row.op === 'delete' ? DEL_BG : row.op === 'insert' ? INS_BG : '';
      return (
        <div key={index} className={`grid grid-cols-[2rem_2rem_1rem_1fr] border-b border-stone-100 last:border-b-0 dark:border-slate-800 ${tone}`}>
          <span className={NUM}>{row.aNumber ?? ''}</span>
          <span className={NUM}>{row.bNumber ?? ''}</span>
          <span className="select-none py-0.5 text-center font-mono text-xs leading-5">{row.op === 'delete' ? '-' : row.op === 'insert' ? '+' : ' '}</span>
          <span className={CELL}><Words parts={row.parts} text={row.text} tone={row.op === 'delete' ? 'del' : 'ins'} /></span>
        </div>
      );
    })}
  </div>
);

const TextDiffWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [left, setLeft] = useState(() => prefillString(lastRun, 'text1', SAMPLE_LEFT));
  const [right, setRight] = useState(() => prefillString(lastRun, 'text2', SAMPLE_RIGHT));
  const [view, setView] = useState<View>(() => prefillOneOf(lastRun, 'view', VIEWS, 'split'));
  const [ignoreCase, setIgnoreCase] = useState(() => prefillBool(lastRun, 'ignoreCase', false));
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(() => prefillBool(lastRun, 'ignoreWhitespace', false));
  const [changesOnly, setChangesOnly] = useState(() => prefillBool(lastRun, 'changesOnly', false));
  const live = useDebounced({ left, right, ignoreCase, ignoreWhitespace }, DEBOUNCE_MS);

  const diff = useMemo(() => computeDiff(live.left, live.right, { ignoreCase: live.ignoreCase, ignoreWhitespace: live.ignoreWhitespace }), [live]);
  const splitItems = useMemo(() => collapse(diff.split, (row) => row.kind === 'equal', changesOnly), [diff, changesOnly]);
  const unifiedItems = useMemo(() => collapse(diff.unified, (row) => row.op === 'equal', changesOnly), [diff, changesOnly]);
  const patch = useMemo(() => diff.unified.map((row) => `${row.op === 'delete' ? '-' : row.op === 'insert' ? '+' : ' '}${row.text}`).join('\n'), [diff]);
  const skipLabel = (count: number): string => t('toolsText.diff.unchanged_lines', { n: count });
  const tooLong = (view === 'split' ? splitItems : unifiedItems).length > ROW_LIMIT;
  const empty = live.left === '' && live.right === '';

  return (
    <Desk wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Paper title={t('toolsText.diff.original')}>
          <PaperTextarea mono rows={8} value={left} onChange={setLeft} wrap={false} ariaLabel={t('toolsText.diff.original')} placeholder={t('toolsText.diff.placeholder')} />
        </Paper>
        <Paper title={t('toolsText.diff.changed')}>
          <PaperTextarea mono rows={8} value={right} onChange={setRight} wrap={false} ariaLabel={t('toolsText.diff.changed')} placeholder={t('toolsText.diff.placeholder')} />
        </Paper>
      </div>

      <Paper
        title={t('toolsText.diff.comparison')}
        actions={(
          <>
            <SoftButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => { setLeft(right); setRight(left); }}>{t('toolsText.diff.swap')}</SoftButton>
            <SoftButton icon={<Eraser className="h-3.5 w-3.5" />} onClick={() => { setLeft(''); setRight(''); }}>{t('uiTools.common.clear')}</SoftButton>
            <CopyButton text={patch} label={t('toolsText.diff.copy_diff')} onCopied={() => record({ text1: left, text2: right, view, ignoreCase, ignoreWhitespace, changesOnly }, { added: diff.added, removed: diff.removed })} />
          </>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div>
            <FieldLabel>{t('toolsText.diff.view')}</FieldLabel>
            <Segmented value={view} onChange={setView} ariaLabel={t('toolsText.diff.view')} options={VIEWS.map((id) => ({ value: id, label: t(`toolsText.diff.view_${id}`) }))} />
          </div>
          <div>
            <FieldLabel>{t('toolsText.diff.options')}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              <ToggleChip active={ignoreCase} onClick={() => setIgnoreCase((v) => !v)}>{t('toolsText.diff.ignore_case')}</ToggleChip>
              <ToggleChip active={ignoreWhitespace} onClick={() => setIgnoreWhitespace((v) => !v)}>{t('toolsText.diff.ignore_whitespace')}</ToggleChip>
              <ToggleChip active={changesOnly} onClick={() => setChangesOnly((v) => !v)}>{t('toolsText.diff.changes_only')}</ToggleChip>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <Tile label={t('toolsText.diff.added')} value={`+${diff.added}`} />
          <Tile label={t('toolsText.diff.removed')} value={`-${diff.removed}`} />
          <Tile accent label={t('toolsText.diff.similarity')} value={`${diff.similarity}%`} />
        </div>

        {empty ? (
          <p className="py-8 text-center text-sm text-slate-400">{t('toolsText.diff.empty')}</p>
        ) : diff.identical ? (
          <Notice tone="ok">{t('toolsText.diff.identical')}</Notice>
        ) : (
          <>
            {tooLong && <Notice tone="warn" className="mb-3">{t('toolsText.diff.truncated', { n: ROW_LIMIT })}</Notice>}
            {view === 'split'
              ? <SplitView items={splitItems.slice(0, ROW_LIMIT)} skipLabel={skipLabel} />
              : <UnifiedView items={unifiedItems.slice(0, ROW_LIMIT)} skipLabel={skipLabel} />}
          </>
        )}
      </Paper>
    </Desk>
  );
};

export default TextDiffWorkbench;
