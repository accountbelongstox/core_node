/** PDF merger: reorderable document stack (drag or arrows) with running totals, merged on the server into one file. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Layers } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Chip, Notice, StatTile, useMediaT } from './MediaKit';
import { JobFeedback, PdfCard, PdfDesk, PdfDropZone, PdfSection, ResultCard, useDocumentIntake, usePdfJob } from './PdfKit';
import { formatBytes } from './mediaFormat';
import { mergePdfs, type PdfOutput } from './pdfServer';

const MIN_FILES = 2;

const PdfMergerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const m = useMediaT();
  const intake = useDocumentIntake(true);
  const { items, move, reorder } = intake;
  const { result, error, running, run, reset, backendMissing } = usePdfJob<PdfOutput>(tool, variant);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const order = items.map((item) => item.id).join(',');
  useEffect(() => { reset(); }, [order, reset]);

  const totals = useMemo(() => ({
    bytes: items.reduce((sum, item) => sum + item.file.size, 0),
    pages: items.every((item) => typeof item.pages === 'number') ? items.reduce((sum, item) => sum + (item.pages as number), 0) : null,
  }), [items]);

  const sortByName = () => reorder((current) => [...current].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })));
  const reverse = () => reorder((current) => [...current].reverse());

  const submit = useCallback(async () => {
    if (items.length < MIN_FILES) return;
    await run({ files: items.map((item) => item.file.name) }, () => mergePdfs(tool.apiMethod, items.map((item) => item.file)));
  }, [items, run, tool.apiMethod]);

  return (
    <PdfDesk>
      <PdfDropZone tone="indigo" multiple onFiles={intake.add} compact={items.length > 0}>
        {items.length > 0 ? ((openPicker: () => void) => (
          <PdfSection
            title={m('merger.stack')}
            aside={(
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="indigo" onClick={openPicker}>{m('merger.add_files')}</Chip>
                <Chip tone="indigo" onClick={sortByName} disabled={items.length < MIN_FILES}>{m('merger.sort_name')}</Chip>
                <Chip tone="indigo" onClick={reverse} disabled={items.length < MIN_FILES}>{m('merger.reverse')}</Chip>
                <Chip tone="indigo" onClick={intake.clear}>{m('common.clear')}</Chip>
              </div>
            )}
          >
            <ol className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => { event.preventDefault(); setOverIndex(index); }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  onDrop={(event) => { if (dragIndex === null) return; event.preventDefault(); event.stopPropagation(); move(dragIndex, index); setDragIndex(null); setOverIndex(null); }}
                  className={`rounded-xl transition-shadow ${overIndex === index && dragIndex !== null && dragIndex !== index ? 'ring-2 ring-indigo-500' : ''} ${dragIndex === index ? 'opacity-50' : ''}`}
                >
                  <PdfCard
                    item={item}
                    tone="indigo"
                    index={index}
                    onRemove={() => intake.remove(item.id)}
                    leading={<GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" aria-hidden />}
                    trailing={(
                      <div className="flex shrink-0 flex-col">
                        <button type="button" aria-label={m('merger.up')} disabled={index === 0} onClick={() => move(index, index - 1)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-100"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label={m('merger.down')} disabled={index === items.length - 1} onClick={() => move(index, index + 1)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-100"><ArrowDown className="h-4 w-4" /></button>
                      </div>
                    )}
                  />
                </li>
              ))}
            </ol>
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">{m('merger.add_more')}</p>
          </PdfSection>
        )) : undefined}
      </PdfDropZone>
      {items.length > 0 && (
        <PdfSection title={m('merger.summary')}>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={m('merger.files')} value={items.length} />
            <StatTile label={m('pdf.page_count')} value={totals.pages ?? '?'} />
            <StatTile label={m('pdf.size')} value={formatBytes(totals.bytes)} />
          </div>
          {items.some((item) => item.encrypted) && <Notice tone="warn">{m('pdf.encrypted_note')}</Notice>}
          {items.length < MIN_FILES && <Notice>{m('merger.need_two')}</Notice>}
          <ActionButton tone="indigo" onClick={() => { void submit(); }} disabled={items.length < MIN_FILES} busy={running} icon={<Layers className="h-4 w-4" />}>{m('merger.run')}</ActionButton>
          <JobFeedback error={error} backendMissing={backendMissing} />
        </PdfSection>
      )}
      {result && <ResultCard output={result} fileName="merged.pdf" tone="indigo" />}
      {intake.rejected && <JobFeedback error={m('pdf.not_pdf')} backendMissing={false} />}
    </PdfDesk>
  );
};

export default PdfMergerWorkbench;
