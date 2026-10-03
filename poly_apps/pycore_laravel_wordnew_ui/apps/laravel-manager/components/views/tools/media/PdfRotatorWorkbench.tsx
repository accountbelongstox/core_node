/** PDF rotator: angle chips plus a page grid whose tiles preview the rotation; rotates all or only the selected pages. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, Notice, Segmented, useMediaT } from './MediaKit';
import { JobFeedback, PageTiles, PdfCard, PdfDesk, PdfDropZone, PdfSection, ResultCard, useDocumentIntake, usePdfJob } from './PdfKit';
import { baseName, pickNumber, pickString } from './mediaFormat';
import { pagesToRows, parseRangeText, rangesToText, rowsToPages } from './pdfOps';
import { rotatePdf, type PdfOutput } from './pdfServer';

const ANGLES = [90, 180, 270] as const;
const SCOPES = ['all', 'selected'] as const;
type Scope = (typeof SCOPES)[number];
const SELECTED_TILE = 'mx-1.5 my-1.5 border-indigo-400 bg-indigo-500/25 text-indigo-700 dark:text-indigo-200';
const PLAIN_TILE = 'mx-1.5 my-1.5 border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400';

const PdfRotatorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const intake = useDocumentIntake(false);
  const item = intake.items[0] ?? null;
  const total = item?.pages ?? null;
  const { result, error, running, run, reset, backendMissing } = usePdfJob<PdfOutput>(tool, variant);
  const [angle, setAngle] = useState<number>(() => {
    const saved = pickNumber(lastRun?.input, 'angle', 90, 270, 90);
    return (ANGLES as readonly number[]).includes(saved) ? saved : 90;
  });
  const [scope, setScope] = useState<Scope>(() => pickString(lastRun?.input, 'scope', SCOPES, 'all'));
  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => { reset(); setSelected([]); setDraft(''); }, [item?.id, reset]);
  useEffect(() => { reset(); }, [angle, scope, selected, reset]);

  const setPages = useCallback((pages: number[]) => {
    const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
    setSelected(sorted);
    setDraft(rangesToText(pagesToRows(sorted)));
  }, []);
  const toggle = (page: number) => setPages(selected.includes(page) ? selected.filter((p) => p !== page) : [...selected, page]);
  const allPages = useMemo(() => (total ? Array.from({ length: total }, (_, i) => i + 1) : []), [total]);
  const onDraft = (text: string) => {
    setDraft(text);
    const rows = parseRangeText(text, total);
    if (rows) setSelected(rowsToPages(rows, total));
  };

  const canRun = Boolean(item) && (scope === 'all' || selected.length > 0);
  const submit = useCallback(async () => {
    if (!item || !canRun) return;
    const pages = scope === 'selected' ? selected : undefined;
    await run({ fileName: item.file.name, angle, scope, pages }, () => rotatePdf(tool.apiMethod, item.file, angle, pages));
  }, [item, canRun, scope, selected, angle, run, tool.apiMethod]);

  const isTurned = (page: number): boolean => scope === 'all' || selected.includes(page);

  return (
    <PdfDesk>
      {!item ? <PdfDropZone tone="indigo" onFiles={intake.add} /> : (
        <>
          <PdfDropZone tone="indigo" onFiles={intake.add}><PdfCard item={item} tone="indigo" onRemove={intake.clear} /></PdfDropZone>
          {item.encrypted && <Notice tone="warn">{m('pdf.encrypted_note')}</Notice>}
          <PdfSection title={m('rotator_pdf.angle')}>
            <div className="flex flex-wrap items-center gap-2">
              {ANGLES.map((value) => (
                <Chip key={value} tone="indigo" active={angle === value} onClick={() => setAngle(value)}>{m(`rotator_pdf.angle_${value}`)}</Chip>
              ))}
            </div>
            <Segmented value={scope} onChange={setScope} tone="indigo" ariaLabel={m('rotator_pdf.scope')} className="sm:max-w-xs" options={SCOPES.map((value) => ({ value, label: m(`rotator_pdf.scope_${value}`) }))} />
          </PdfSection>
          <PdfSection title={m('rotator_pdf.pages')} aside={scope === 'selected' ? <span className="font-mono text-[11px] text-slate-500">{m('rotator_pdf.selected_count', { n: selected.length })}</span> : undefined}>
            {total ? (
              <PageTiles
                total={total}
                onToggle={scope === 'selected' ? toggle : undefined}
                tileClass={(page) => (isTurned(page) ? SELECTED_TILE : PLAIN_TILE)}
                tileStyle={(page) => (isTurned(page) ? { transform: `rotate(${angle}deg)` } : {})}
              />
            ) : <Notice>{m('splitter.unknown_pages')}</Notice>}
            {scope === 'selected' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="indigo" disabled={!total} onClick={() => setPages(allPages)}>{m('rotator_pdf.sel_all')}</Chip>
                <Chip tone="indigo" disabled={!total} onClick={() => setPages(allPages.filter((p) => p % 2 === 1))}>{m('rotator_pdf.sel_odd')}</Chip>
                <Chip tone="indigo" disabled={!total} onClick={() => setPages(allPages.filter((p) => p % 2 === 0))}>{m('rotator_pdf.sel_even')}</Chip>
                <Chip tone="indigo" disabled={!total} onClick={() => setPages(allPages.filter((p) => !selected.includes(p)))}>{m('rotator_pdf.sel_invert')}</Chip>
                <Chip tone="indigo" onClick={() => setPages([])}>{m('rotator_pdf.sel_none')}</Chip>
                <input value={draft} onChange={(e) => onDraft(e.target.value)} aria-label={m('splitter.text')} placeholder="1-3, 5" className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </div>
            )}
            <ActionButton tone="indigo" onClick={() => { void submit(); }} disabled={!canRun} busy={running} icon={<RotateCw className="h-4 w-4" />}>{m('rotator_pdf.run')}</ActionButton>
            <JobFeedback error={error} backendMissing={backendMissing} />
          </PdfSection>
          {result && <ResultCard output={result} fileName={`${baseName(item.file.name)}-rotated${angle}.pdf`} tone="indigo" />}
        </>
      )}
      {intake.rejected && <JobFeedback error={m('pdf.not_pdf')} backendMissing={false} />}
    </PdfDesk>
  );
};

export default PdfRotatorWorkbench;
