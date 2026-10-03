/** Base64 file encoder: drop a file, get Base64 / data URI / HTML / CSS snippets with size and image preview. */
import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { bytesToBase64, wrapLines } from './convertCodecs';
import { DISPLAY_CHARS, MAX_FILE_BYTES, readFileBytes, sniffMime } from './convertFiles';
import {
  ConvertPage, CopyButton, DropZone, formatBytes, ICON_BUTTON_CLASS, LABEL_CLASS, MONO_CLASS, Notice, Panel, SkyChips, StatChip, ToggleField, Toolbar, ToolbarGroup,
  useConvertT, useRecorder,
} from './convertKit';

type OutputFormat = 'raw' | 'dataUri' | 'html' | 'css';

interface LoadedFile {
  name: string;
  size: number;
  mime: string;
  base64: string;
}

const FORMATS: OutputFormat[] = ['raw', 'dataUri', 'html', 'css'];
const WRAP_WIDTH = 76;

const buildOutput = (file: LoadedFile, format: OutputFormat, wrap: boolean): string => {
  const dataUri = `data:${file.mime};base64,${file.base64}`;
  switch (format) {
    case 'dataUri': return dataUri;
    case 'html': return file.mime.startsWith('image/') ? `<img src="${dataUri}" alt="${file.name.replace(/"/g, '&quot;')}">` : `<a href="${dataUri}" download="${file.name.replace(/"/g, '&quot;')}">${file.name.replace(/[<&]/g, '')}</a>`;
    case 'css': return `url("${dataUri}")`;
    default: return wrap ? wrapLines(file.base64, WRAP_WIDTH) : file.base64;
  }
};

const Base64FileEncoderWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const tc = useConvertT();
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>('raw');
  const [wrap, setWrap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useRecorder(tool.id, variant);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const load = async (picked: File): Promise<void> => {
    setError(null);
    if (picked.size > MAX_FILE_BYTES) {
      setError(tc('errors.file_too_large', { max: formatBytes(MAX_FILE_BYTES) }));
      return;
    }
    setBusy(true);
    try {
      const bytes = await readFileBytes(picked);
      const mime = picked.type || sniffMime(bytes);
      setFile({ name: picked.name, size: picked.size, mime, base64: bytesToBase64(bytes) });
      setPreviewUrl(mime.startsWith('image/') ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })) : null);
    } catch {
      setError(tc('errors.file_read_failed'));
    } finally {
      setBusy(false);
    }
  };

  const output = useMemo(() => (file ? buildOutput(file, format, wrap) : ''), [file, format, wrap]);
  const recordCurrent = (): void => {
    if (file) record({ fileName: file.name, size: file.size, mime: file.mime, format }, { length: output.length });
  };
  const download = (): void => {
    downloadAsFile(output, `${file?.name ?? 'file'}.base64.txt`, 'text/plain;charset=utf-8');
    recordCurrent();
  };

  return (
    <ConvertPage>
      <DropZone onFile={load} busy={busy} title={tc('file_encoder.drop_title')} hint={tc('file_encoder.drop_hint', { max: formatBytes(MAX_FILE_BYTES) })} />
      {error && <Notice>{error}</Notice>}
      {file && (
        <>
          <Panel className="flex flex-wrap items-center gap-3 p-3">
            {previewUrl ? (
              <img src={previewUrl} alt={file.name} className="h-20 w-20 rounded-lg border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300"><FileText className="h-8 w-8" /></div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={file.name}>{file.name}</div>
              <div className="flex flex-wrap gap-1.5">
                <StatChip title={tc('file_encoder.mime')}>{file.mime}</StatChip>
                <StatChip title={tc('file_encoder.original')}>{formatBytes(file.size)}</StatChip>
                <StatChip title={tc('file_encoder.encoded')}>{`${formatBytes(file.base64.length)} (+${file.size ? Math.round((file.base64.length / file.size - 1) * 100) : 0}%)`}</StatChip>
              </div>
            </div>
          </Panel>
          <Toolbar>
            <ToolbarGroup label={tc('file_encoder.format')}>
              <SkyChips value={format} onChange={setFormat} options={FORMATS.map((id) => ({ value: id, label: tc(`file_encoder.format_${id}`) }))} />
            </ToolbarGroup>
            {format === 'raw' && <ToggleField label={tc('file_encoder.wrap')} on={wrap} onChange={setWrap} />}
          </Toolbar>
          <Panel className="overflow-hidden">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-700/50">
              <span className={LABEL_CLASS}>{tc(`file_encoder.format_${format}`)}</span>
              <div className="flex items-center gap-0.5">
                <button type="button" className={ICON_BUTTON_CLASS} onClick={download} title={tc('common.download')}><Download className="h-3.5 w-3.5" />{tc('common.download')}</button>
                <CopyButton text={output} onCopied={recordCurrent} />
              </div>
            </header>
            <textarea readOnly value={output.length > DISPLAY_CHARS ? output.slice(0, DISPLAY_CHARS) : output} rows={8} spellCheck={false} wrap="soft" className={`${MONO_CLASS} min-h-[10rem] w-full resize-y bg-transparent px-3 py-2.5 text-slate-900 focus:outline-none dark:text-slate-100`} />
            {output.length > DISPLAY_CHARS && <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700/50 dark:text-slate-400">{tc('file_encoder.truncated', { shown: DISPLAY_CHARS.toLocaleString(), total: output.length.toLocaleString() })}</div>}
          </Panel>
        </>
      )}
    </ConvertPage>
  );
};

export default Base64FileEncoderWorkbench;
