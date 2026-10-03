/** PDF splitter: page ribbon coloured by output part, range builder with presets, one downloadable file per range (or a ZIP). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Plus, Scissors, Trash2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, NumberField, Notice, useMediaT } from './MediaKit';
import { JobFeedback, PageTiles, PdfCard, PdfDesk, PdfDropZone, PdfSection, ResultCard, useDocumentIntake, usePdfJob } from './PdfKit';
import { baseName, downloadBlob } from './mediaFormat';
import { clampPage, pagePartMap, parseRangeText, presetRanges, rangesToText, serializeRanges, type PageRange, type RangePreset } from './pdfOps';
import { splitPdf, type PdfOutput } from './pdfServer';
import { buildZip } from './zip';

const PRESETS: readonly RangePreset[] = ['each', 'odd', 'even', 'halves', 'every'];
const PART_COLORS = [
  'border-indigo-400 bg-indigo-500/20 text-indigo-700 dark:text-indigo-200',
  'border-sky-400 bg-sky-500/20 text-sky-700 dark:text-sky-200',
  'border-violet-400 bg-violet-500/20 text-violet-700 dark:text-violet-200',
  'border-teal-400 bg-teal-500/20 text-teal-700 dark:text-teal-200',
  'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-200',
  'border-orange-400 bg-orange-500/20 text-orange-700 dark:text-orange-200',
];
const UNUSED_TILE = 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900';
const MAX_RANGES = 200;

const PdfSplitterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const m = useMediaT();
  const intake = useDocumentIntake(false);
  const item = intake.items[0] ?? null;
  const total = item?.pages ?? null;
  const { result, error, running, run, reset, backendMissing } = usePdfJob<PdfOutput[]>(tool, variant);
  const [rows, setRows] = useState<PageRange[]>([{ from: 1, to: 1 }]);
  const [draft, setDraft] = useState('1');
  const [step, setStep] = useState(2);
  const fromText = useRef(false);

  useEffect(() => {
    if (fromText.current) {
      fromText.current = false;
      return;
    }
    setDraft(rangesToText(rows));
  }, [rows]);

  useEffect(() => { reset(); }, [item?.id, reset]);

  useEffect(() => {
    if (total !== null && total > 0) setRows((prev) => prev.map((row) => ({ from: Math.min(row.from, total), to: Math.min(row.to, total) })));
  }, [total]);

  const changeRow = (index: number, patch: Partial<PageRange>) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const applyPreset = (kind: RangePreset) => {
    if (total === null || total < 1) return;
    setRows(presetRanges(kind, total, step).slice(0, MAX_RANGES));
  };
  const onDraft = (text: string) => {
    setDraft(text);
    const parsed = parseRangeText(text, total);
    if (parsed) {
      fromText.current = true;
      setRows(parsed);
    }
  };

  const partMap = useMemo(() => (total ? pagePartMap(rows, total) : []), [rows, total]);
  const invalid = rows.length === 0 || rows.some((row) => row.from < 1 || row.to < row.from || (total !== null && row.to > total));
  const names = useMemo(() => (item ? (result ?? []).map((part, i) => `${baseName(item.file.name)}-part${i + 1}-p${part.label.replace(/\s+/g, '')}.pdf`) : []), [item, result]);

  const submit = useCallback(async () => {
    if (!item || invalid) return;
    const ranges = serializeRanges(rows);
    await run({ fileName: item.file.name, ranges }, () => splitPdf(tool.apiMethod, item.file, ranges));
  }, [item, invalid, rows, run, tool.apiMethod]);

  const downloadZip = useCallback(async () => {
    if (!result || !item) return;
    const entries = await Promise.all(result.map(async (part, i) => ({ name: names[i], data: new Uint8Array(await part.blob.arrayBuffer()) })));
    downloadBlob(buildZip(entries), `${baseName(item.file.name)}-split.zip`);
  }, [result, item, names]);

  return (
    <PdfDesk>
      {!item ? (
        <PdfDropZone tone="indigo" onFiles={intake.add} />
      ) : (
        <>
          <PdfDropZone tone="indigo" onFiles={intake.add}>
            <PdfCard item={item} tone="indigo" onRemove={intake.clear} />
          </PdfDropZone>
          {item.encrypted && <Notice tone="warn">{m('pdf.encrypted_note')}</Notice>}
          <PdfSection title={m('splitter.ranges')} aside={<span className="font-mono text-[11px] text-slate-500">{m('splitter.parts', { n: rows.length })}</span>}>
            {total ? (
              <PageTiles total={total} tileClass={(page) => (partMap[page - 1] >= 0 ? PART_COLORS[partMap[page - 1] % PART_COLORS.length] : UNUSED_TILE)} />
            ) : <Notice>{m('splitter.unknown_pages')}</Notice>}
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((kind) => <Chip key={kind} tone="indigo" disabled={!total} onClick={() => applyPreset(kind)}>{m(`splitter.preset_${kind}`)}</Chip>)}
              <NumberField value={step} min={1} max={total ?? undefined} ariaLabel={m('splitter.preset_every')} className="w-16" onChange={(v) => setStep(Number.isNaN(v) ? 1 : Math.max(1, Math.floor(v)))} />
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((row, index) => {
                const rowInvalid = row.from < 1 || row.to < row.from || (total !== null && row.to > total);
                return (
                  <div key={index} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${rowInvalid ? 'border-red-400/60 bg-red-500/5' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className={`h-3 w-3 shrink-0 rounded-full border ${PART_COLORS[index % PART_COLORS.length]}`} />
                    <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-500">{m('splitter.part', { index: index + 1 })}</span>
                    <NumberField value={row.from} min={1} max={total ?? undefined} ariaLabel={m('splitter.from')} className="w-20" onChange={(v) => changeRow(index, { from: Number.isNaN(v) ? 1 : clampPage(v, total) })} />
                    <span className="text-slate-400">-</span>
                    <NumberField value={row.to} min={1} max={total ?? undefined} ariaLabel={m('splitter.to')} className="w-20" onChange={(v) => changeRow(index, { to: Number.isNaN(v) ? 1 : clampPage(v, total) })} />
                    <span className="min-w-0 flex-1 truncate text-right font-mono text-[11px] text-slate-400">{rowInvalid ? '' : m('pdf.pages', { n: row.to - row.from + 1 })}</span>
                    <button type="button" aria-label={m('common.remove')} disabled={rows.length === 1} onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton tone="indigo" variant="ghost" disabled={rows.length >= MAX_RANGES} onClick={() => setRows((prev) => { const next = clampPage((prev[prev.length - 1]?.to ?? 0) + 1, total); return [...prev, { from: next, to: next }]; })} icon={<Plus className="h-4 w-4" />}>{m('splitter.add_range')}</ActionButton>
                <input value={draft} onChange={(e) => onDraft(e.target.value)} aria-label={m('splitter.text')} placeholder="1-3, 5, 8-10" className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </div>
            </div>
            <ActionButton tone="indigo" onClick={() => { void submit(); }} disabled={invalid} busy={running} icon={<Scissors className="h-4 w-4" />}>{m('splitter.run')}</ActionButton>
            <JobFeedback error={error} backendMissing={backendMissing} invalid={invalid ? m('splitter.invalid') : null} />
          </PdfSection>
          {result && (
            <PdfSection title={m('splitter.results')} aside={result.length > 1 ? <ActionButton tone="indigo" variant="ghost" onClick={() => { void downloadZip(); }} icon={<Archive className="h-4 w-4" />}>{m('splitter.zip')}</ActionButton> : undefined}>
              <div className="flex flex-col gap-2">
                {result.map((part, i) => <ResultCard key={i} output={part} fileName={names[i]} tone="indigo" label={m('splitter.pages_label', { pages: part.label })} />)}
              </div>
            </PdfSection>
          )}
        </>
      )}
      {intake.rejected && <JobFeedback error={m('pdf.not_pdf')} backendMissing={false} />}
    </PdfDesk>
  );
};

export default PdfSplitterWorkbench;
