/** Base64 file decoder: paste Base64 or a data URI, detect the type, preview it and download the file. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, File as FileIcon, FolderOpen } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { base64ToBytes } from './convertCodecs';
import { decodeTextBytes, extensionForMime, parseDataUri, sniffMime, TEXT_PREVIEW_CHARS } from './convertFiles';
import {
  ConvertPage, downloadBlob, errorMessage, formatBytes, ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Notice, Panel, PRIMARY_BUTTON_CLASS,
  prefillOf, StatChip, TextPane, useConvertT, useRecorder,
} from './convertKit';

interface DecoderInput {
  text: string;
}

interface Decoded {
  bytes: Uint8Array;
  mime: string;
}

const Base64FileDecoderWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const prefill = prefillOf<DecoderInput>(lastRun);
  const [text, setText] = useState(prefill.text ?? '');
  const [fileName, setFileName] = useState('');
  const [fileNameTouched, setFileNameTouched] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const record = useRecorder(tool.id, variant);

  const decoded = useMemo<{ value: Decoded | null; error: unknown }>(() => {
    if (!text.trim()) return { value: null, error: null };
    try {
      const { mime, payload } = parseDataUri(text);
      const bytes = base64ToBytes(payload);
      return { value: { bytes, mime: mime || sniffMime(bytes) }, error: null };
    } catch (error) {
      return { value: null, error };
    }
  }, [text]);
  const file = decoded.value;

  useEffect(() => {
    if (!file || !(file.mime.startsWith('image/') || file.mime.startsWith('audio/') || file.mime.startsWith('video/'))) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mime }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const extension = file ? extensionForMime(file.mime) : 'bin';
  const effectiveName = fileNameTouched && fileName ? fileName : `decoded.${extension}`;
  const textPreview = useMemo(() => {
    if (!file) return null;
    const content = decodeTextBytes(file.bytes);
    return content === null ? null : content.slice(0, TEXT_PREVIEW_CHARS);
  }, [file]);

  const download = (): void => {
    if (!file) return;
    downloadBlob(new Blob([file.bytes as BlobPart], { type: file.mime }), effectiveName);
    record({ text: text.length > 2000 ? '' : text }, { fileName: effectiveName, mime: file.mime, size: file.bytes.length });
  };

  const openFile = async (picked: File | undefined): Promise<void> => {
    if (picked) setText((await picked.text()).trim());
  };

  return (
    <ConvertPage>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPane
          label={tc('file_decoder.input')}
          value={text}
          onChange={setText}
          placeholder={tc('file_decoder.placeholder')}
          rows={12}
          invalid={Boolean(decoded.error)}
          actions={(
            <>
              <button type="button" className={ICON_BUTTON_CLASS} onClick={() => fileInput.current?.click()} title={tc('file_decoder.open_text')}><FolderOpen className="h-3.5 w-3.5" />{tc('file_decoder.open_text')}</button>
              <input ref={fileInput} type="file" accept=".txt,.b64,.base64,text/*" className="hidden" onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = ''; }} />
            </>
          )}
          footer={text ? <StatChip>{formatBytes(text.length)}</StatChip> : null}
        />
        <Panel className="flex min-w-0 flex-col overflow-hidden">
          <header className="border-b border-slate-100 px-3 py-1.5 dark:border-slate-700/50"><span className={LABEL_CLASS}>{tc('file_decoder.result')}</span></header>
          {file ? (
            <div className="flex flex-1 flex-col gap-3 p-3">
              <div className="flex flex-wrap gap-1.5">
                <StatChip title={tc('file_decoder.mime')}>{file.mime}</StatChip>
                <StatChip title={tc('file_decoder.size')}>{formatBytes(file.bytes.length)}</StatChip>
              </div>
              <div className="flex min-h-[8rem] flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700/60 dark:bg-slate-900/40">
                {previewUrl && file.mime.startsWith('image/') && <img src={previewUrl} alt={effectiveName} className="max-h-72 max-w-full object-contain" />}
                {previewUrl && file.mime.startsWith('audio/') && <audio controls src={previewUrl} className="w-full" />}
                {previewUrl && file.mime.startsWith('video/') && <video controls src={previewUrl} className="max-h-72 max-w-full" />}
                {!previewUrl && textPreview !== null && <pre className={`${MONO_CLASS} max-h-72 w-full overflow-auto whitespace-pre-wrap break-all text-slate-800 dark:text-slate-100`}>{textPreview}</pre>}
                {!previewUrl && textPreview === null && (
                  <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400"><FileIcon className="h-10 w-10" /><span className="text-xs">{tc('file_decoder.no_preview')}</span></div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={effectiveName} onChange={(event) => { setFileName(event.target.value); setFileNameTouched(true); }} aria-label={tc('file_decoder.file_name')} className={`${INPUT_CLASS} ${MONO_CLASS} min-w-[10rem] flex-1`} />
                <button type="button" onClick={download} className={PRIMARY_BUTTON_CLASS}><Download className="h-3.5 w-3.5" />{tc('common.download')}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">{tc('file_decoder.empty')}</div>
          )}
        </Panel>
      </div>
      {decoded.error ? <Notice>{errorMessage(tc, decoded.error)}</Notice> : null}
    </ConvertPage>
  );
};

export default Base64FileDecoderWorkbench;
