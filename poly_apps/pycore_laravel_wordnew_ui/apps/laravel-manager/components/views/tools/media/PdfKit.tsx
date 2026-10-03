/** Private kit of the PDF workbenches: document intake, file cards, page tiles, result cards and server-job state. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Lock, X } from 'lucide-react';
import { useToolRun } from '../toolRunner';
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import { ActionButton, DropZone, ErrorBanner, Notice, RunBadge, StatTile, TONE, useMediaT, type Tone } from './MediaKit';
import { downloadBlob, formatBytes, useObjectUrl } from './mediaFormat';
import { PDF_MISSING_PATTERN, type PdfOutput } from './pdfServer';
import { isPdfFile, readPdfInfo } from './pdfOps';

export const PDF_ACCEPT = 'application/pdf,.pdf';
const MAX_TILES = 240;

export interface PdfItem {
  id: string;
  file: File;
  /** undefined while the page count is being read. */
  pages: number | null | undefined;
  encrypted: boolean;
}

let itemSeq = 0;

export const useDocumentIntake = (multiple: boolean) => {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [rejected, setRejected] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const add = useCallback((files: File[]) => {
    const pdfs = files.filter(isPdfFile);
    setRejected(pdfs.length < files.length);
    if (pdfs.length === 0) return;
    const fresh: PdfItem[] = (multiple ? pdfs : pdfs.slice(0, 1)).map((file) => ({ id: `pdf-${++itemSeq}`, file, pages: undefined, encrypted: false }));
    setItems((prev) => (multiple ? [...prev, ...fresh] : fresh));
    fresh.forEach((item) => {
      void readPdfInfo(item.file).then((info) => {
        if (mounted.current) setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, pages: info.pages, encrypted: info.encrypted } : p)));
      });
    });
  }, [multiple]);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
  const clear = useCallback(() => { setItems([]); setRejected(false); }, []);
  const reorder = useCallback((arrange: (current: PdfItem[]) => PdfItem[]) => setItems((prev) => arrange(prev)), []);
  const move = useCallback((from: number, to: number) => setItems((prev) => {
    if (to < 0 || to >= prev.length || from === to) return prev;
    const next = [...prev];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }), []);

  return { items, rejected, add, remove, clear, move, reorder };
};

export const PdfDropZone: React.FC<{ tone: Tone; multiple?: boolean; onFiles: (files: File[]) => void; compact?: boolean; children?: React.ReactNode | ((openPicker: () => void) => React.ReactNode) }> = ({ tone, multiple = false, onFiles, compact = false, children }) => {
  const m = useMediaT();
  return (
    <DropZone
      accept={PDF_ACCEPT}
      multiple={multiple}
      tone={tone}
      compact={compact}
      title={m(multiple ? 'pdf.drop_many' : 'pdf.drop_one')}
      hint={m('pdf.drop_hint')}
      pickLabel={m(multiple ? 'pdf.pick_many' : 'pdf.pick_one')}
      icon={<FileText className="h-7 w-7" />}
      onFiles={onFiles}
    >
      {children}
    </DropZone>
  );
};

export const PageCountBadge: React.FC<{ item: PdfItem }> = ({ item }) => {
  const m = useMediaT();
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
      {item.pages === undefined ? '...' : item.pages === null ? m('pdf.pages_unknown') : m('pdf.pages', { n: item.pages })}
    </span>
  );
};

export const PdfCard: React.FC<{ item: PdfItem; tone: Tone; onRemove?: () => void; leading?: React.ReactNode; trailing?: React.ReactNode; index?: number }> = ({ item, tone, onRemove, leading, trailing, index }) => {
  const m = useMediaT();
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
      {leading}
      <div className={`flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-md ${TONE[tone].soft}`}>
        <FileText className="h-5 w-5" />
        <span className="text-[8px] font-black">{index === undefined ? 'PDF' : index + 1}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={item.file.name}>{item.file.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-mono">{formatBytes(item.file.size)}</span>
          <PageCountBadge item={item} />
          {item.encrypted && <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Lock className="h-3 w-3" />{m('pdf.encrypted')}</span>}
        </div>
      </div>
      {trailing}
      {onRemove && <button type="button" aria-label={m('common.remove')} onClick={onRemove} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>}
    </div>
  );
};

/** One tile per page; tone/state per page come from the caller. */
export const PageTiles: React.FC<{
  total: number; tileClass: (page: number) => string; onToggle?: (page: number) => void; tileStyle?: (page: number) => React.CSSProperties;
}> = ({ total, tileClass, onToggle, tileStyle }) => {
  const m = useMediaT();
  const shown = Math.min(total, MAX_TILES);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: shown }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          disabled={!onToggle}
          onClick={() => onToggle?.(page)}
          className={`flex h-11 w-8 items-end justify-center rounded-sm border pb-0.5 font-mono text-[10px] font-bold transition-all ${onToggle ? 'cursor-pointer' : 'cursor-default'} ${tileClass(page)}`}
          style={tileStyle?.(page)}
        >
          {page}
        </button>
      ))}
      {total > shown && <span className="self-center text-[11px] text-slate-500">{m('pdf.more_pages', { n: total - shown })}</span>}
    </div>
  );
};

export const ResultCard: React.FC<{ output: PdfOutput; fileName: string; tone: Tone; extra?: React.ReactNode; openable?: boolean; label?: string }> = ({ output, fileName, tone, extra, openable = true, label }) => {
  const m = useMediaT();
  const url = useObjectUrl(output.blob);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
      <div className={`flex h-12 w-10 shrink-0 items-center justify-center rounded-md ${TONE[tone].soft}`}><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={fileName}>{label ? `${label} - ${fileName}` : fileName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-mono">{formatBytes(output.blob.size)}</span>
          {output.pages !== null && <span className="font-mono">{m('pdf.pages', { n: output.pages })}</span>}
          {extra}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {openable && url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <ExternalLink className="h-3.5 w-3.5" />{m('pdf.open')}
          </a>
        )}
        <ActionButton tone={tone} onClick={() => downloadBlob(output.blob, fileName)} icon={<Download className="h-4 w-4" />}>{m('common.download')}</ActionButton>
      </div>
    </div>
  );
};

export const PdfStats: React.FC<{ item: PdfItem }> = ({ item }) => {
  const m = useMediaT();
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile label={m('pdf.size')} value={formatBytes(item.file.size)} />
      <StatTile label={m('pdf.page_count')} value={item.pages === undefined ? '...' : item.pages ?? m('pdf.pages_unknown')} />
    </div>
  );
};

/** Server run state shared by the PDF workbenches; flags a missing server dependency honestly. */
export const usePdfJob = <T,>(tool: ToolDefinition, variant: string) => {
  const job = useToolRun<T>(tool.id, variant);
  const backendMissing = Boolean(job.error && PDF_MISSING_PATTERN.test(job.error));
  return { ...job, backendMissing };
};

export const JobFeedback: React.FC<{ error: string | null; backendMissing: boolean; invalid?: string | null }> = ({ error, backendMissing, invalid }) => {
  const m = useMediaT();
  return (
    <>
      {backendMissing && <Notice tone="warn">{m('pdf.backend_missing')}</Notice>}
      <ErrorBanner message={error ?? invalid ?? null} />
    </>
  );
};

export const ServerBadge: React.FC = () => <RunBadge server />;

export const PdfDesk: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3 sm:p-4">
    <div className="flex justify-end"><ServerBadge /></div>
    {children}
  </div>
);

export const PdfSection: React.FC<{ title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({ title, children, aside }) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);
