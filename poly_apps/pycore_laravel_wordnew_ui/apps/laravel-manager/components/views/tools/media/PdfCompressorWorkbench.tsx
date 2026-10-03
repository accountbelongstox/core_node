/** PDF compressor: Ghostscript quality presets as selectable cards, before/after size bars for the server result. */
import React, { useCallback, useEffect, useState } from 'react';
import { Minimize2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { ActionButton, Notice, TONE, useMediaT } from './MediaKit';
import { JobFeedback, PdfCard, PdfDesk, PdfDropZone, PdfSection, ResultCard, useDocumentIntake, usePdfJob } from './PdfKit';
import { SizeBars } from './SizeBars';
import { baseName, pickString } from './mediaFormat';
import { compressPdf, type PdfOutput, type PdfQuality } from './pdfServer';

const QUALITIES: ReadonlyArray<{ id: PdfQuality; dpi: number; level: number }> = [
  { id: 'screen', dpi: 72, level: 4 },
  { id: 'ebook', dpi: 150, level: 3 },
  { id: 'printer', dpi: 300, level: 2 },
  { id: 'prepress', dpi: 300, level: 1 },
];
const QUALITY_IDS = QUALITIES.map((q) => q.id);
const MAX_LEVEL = 4;

const PdfCompressorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const m = useMediaT();
  const intake = useDocumentIntake(false);
  const item = intake.items[0] ?? null;
  const { result, error, running, run, reset, backendMissing } = usePdfJob<PdfOutput>(tool, variant);
  const [quality, setQuality] = useState<PdfQuality>(() => pickString(lastRun?.input, 'quality', QUALITY_IDS, 'ebook'));

  useEffect(() => { reset(); }, [item?.id, quality, reset]);

  const submit = useCallback(async () => {
    if (!item) return;
    await run({ fileName: item.file.name, quality }, () => compressPdf(tool.apiMethod, item.file, quality));
  }, [item, quality, run, tool.apiMethod]);

  return (
    <PdfDesk>
      {!item ? <PdfDropZone tone="red" onFiles={intake.add} /> : (
        <>
          <PdfDropZone tone="red" onFiles={intake.add}><PdfCard item={item} tone="red" onRemove={intake.clear} /></PdfDropZone>
          {item.encrypted && <Notice tone="warn">{m('pdf.encrypted_note')}</Notice>}
          <PdfSection title={m('compressor_pdf.quality')}>
            <div role="radiogroup" aria-label={m('compressor_pdf.quality')} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {QUALITIES.map(({ id, dpi, level }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={quality === id}
                  onClick={() => setQuality(id)}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-3 text-left transition-colors ${quality === id ? `${TONE.red.soft} ${TONE.red.ring}` : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200'}`}
                >
                  <div className="flex items-center justify-between"><span className="text-sm font-bold">{m(`compressor_pdf.q_${id}`)}</span><span className="font-mono text-[10px] opacity-70">{dpi} dpi</span></div>
                  <span className="text-[11px] opacity-80">{m(`compressor_pdf.q_${id}_hint`)}</span>
                  <span className="flex gap-0.5" aria-hidden>{Array.from({ length: MAX_LEVEL }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < level ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`} />)}</span>
                </button>
              ))}
            </div>
            <ActionButton tone="red" onClick={() => { void submit(); }} busy={running} icon={<Minimize2 className="h-4 w-4" />}>{m('compressor_pdf.run')}</ActionButton>
            <JobFeedback error={error} backendMissing={backendMissing} />
          </PdfSection>
          {result && (
            <PdfSection title={m('compressor_pdf.result')}>
              <SizeBars before={item.file.size} after={result.blob.size} tone="red" />
              {result.blob.size >= item.file.size && <Notice tone="warn">{m('compressor_pdf.not_smaller')}</Notice>}
              <ResultCard output={result} fileName={`${baseName(item.file.name)}-${quality}.pdf`} tone="red" />
            </PdfSection>
          )}
        </>
      )}
      {intake.rejected && <JobFeedback error={m('pdf.not_pdf')} backendMissing={false} />}
    </PdfDesk>
  );
};

export default PdfCompressorWorkbench;
