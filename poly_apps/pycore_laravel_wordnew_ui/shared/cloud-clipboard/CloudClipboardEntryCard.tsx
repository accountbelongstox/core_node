import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Upload, RotateCcw } from 'lucide-react';
import { CLOUD_CLIPBOARD, type CloudClipboardEntry } from '../../core/contracts/CloudClipboardContract';
import type { CloudClipboardModel } from './CloudClipboardModel';
import CloudClipboardAttachment from './CloudClipboardAttachment';
import CloudClipboardCopyButton from './CloudClipboardCopyButton';

interface Props {
  model: CloudClipboardModel;
  entry: CloudClipboardEntry;
  latest: boolean;
  busy: boolean;
  pending: boolean;
  focus: boolean;
}

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-500/10 disabled:opacity-40';

function CloudClipboardEntryCard({ model, entry, latest, busy, pending, focus }: Props) {
  const { t } = useTranslation('cloudClipboard');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const selection = useRef({ text: entry.text, start: 0, end: 0, direction: 'none' as 'none' | 'forward' | 'backward' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (focus) textarea.current?.focus({ preventScroll: true });
  }, [focus]);

  useLayoutEffect(() => {
    const input = textarea.current;
    const previous = selection.current;
    const text = entry.text;
    let start = 0;
    let oldEnd = previous.text.length;
    let newEnd = text.length;
    const mapOffset = (offset: number): number => offset <= start ? offset
      : offset >= oldEnd ? offset + newEnd - oldEnd : newEnd;
    if (previous.text === text || composing.current) return;
    while (start < Math.min(oldEnd, newEnd) && previous.text[start] === text[start]) start++;
    while (oldEnd > start && newEnd > start && previous.text[oldEnd - 1] === text[newEnd - 1]) { oldEnd--; newEnd--; }
    if (input && document.activeElement === input) {
      input.setSelectionRange(mapOffset(previous.start), mapOffset(previous.end), previous.direction);
    }
    selection.current = { ...previous, text, start: mapOffset(previous.start), end: mapOffset(previous.end) };
  }, [entry.text]);

  const rememberSelection = (input: HTMLTextAreaElement): void => {
    selection.current = { text: input.value, start: input.selectionStart, end: input.selectionEnd,
      direction: input.selectionDirection };
  };

  const upload = async (files: File[]): Promise<void> => {
    if (!files.length) return;
    if (files.length > CLOUD_CLIPBOARD.max_files_per_upload
      || files.some((file) => file.size > CLOUD_CLIPBOARD.max_file_kb * 1024)) {
      setError('invalidInput');
      return;
    }
    setError('');
    await model.action('upload', entry.id, {}, files);
  };

  const remove = async (fileId?: string): Promise<void> => {
    if (!window.confirm(t(fileId ? 'confirmFile' : 'confirmDelete'))) return;
    await model.action(fileId ? 'delete-file' : 'delete', entry.id, fileId ? { file_id: fileId } : {});
  };

  return <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3"
    onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
    <div className="flex gap-2 flex-wrap items-center">
      <div className="mr-auto flex gap-2 items-center text-xs text-slate-500">
        {latest && <span className="rounded-full bg-indigo-500/10 text-indigo-500 px-2 py-1">{t('latestEntry')}</span>}
        <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
        <span title={t(busy ? 'saving' : pending ? 'pending' : 'saved')}
          className={`h-1.5 w-1.5 rounded-full ${busy || pending ? 'bg-amber-400' : 'bg-emerald-500'}`} />
      </div>
      <CloudClipboardCopyButton text={entry.text} />
      {!latest && <button type="button" className={buttonClass} disabled={busy} title={t('restore')}
        onClick={() => void model.action('restore', entry.id)}><RotateCcw size={14} />{t('restore')}</button>}
      <button type="button" className={buttonClass} disabled={busy} onClick={() => void remove()}><Trash2 size={14} />{t('delete')}</button>
    </div>
    <textarea ref={textarea} className="w-full min-h-36 resize-y rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm font-mono"
      value={entry.text} maxLength={CLOUD_CLIPBOARD.max_text_length} placeholder={t('placeholder')} aria-label={t('entryContent')}
      onChange={(event) => { rememberSelection(event.currentTarget); model.edit(entry.id, event.currentTarget.value); }}
      onSelect={(event) => rememberSelection(event.currentTarget)}
      onFocus={() => model.focus(entry.id, true)} onBlur={() => { model.focus(entry.id, false); void model.flush(entry.id); }}
      onCompositionStart={() => { composing.current = true; model.compose(entry.id, true); }}
      onCompositionEnd={(event) => { composing.current = false; rememberSelection(event.currentTarget);
        model.edit(entry.id, event.currentTarget.value); model.compose(entry.id, false); }}
      onPaste={(event) => {
        if (event.clipboardData.files.length) { event.preventDefault(); void upload(Array.from(event.clipboardData.files)); }
      }} />
    <div className="flex gap-2 items-center flex-wrap">
      <input type="file" multiple ref={uploadInput} className="hidden" onChange={(event) => {
        void upload(Array.from(event.target.files ?? [])); event.target.value = '';
      }} />
      <button type="button" className={buttonClass} disabled={busy} onClick={() => uploadInput.current?.click()}><Upload size={14} />{t('upload')}</button>
      <span className="text-xs text-slate-500">{t('uploadLimit', { count: CLOUD_CLIPBOARD.max_files_per_upload, mb: CLOUD_CLIPBOARD.max_file_kb / 1024 })}</span>
    </div>
    {error && <p role="status" className="text-xs text-amber-600 dark:text-amber-400">{t(error)}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {entry.files.map((file) => <CloudClipboardAttachment key={file.id} model={model} entryId={entry.id} file={file}
        disabled={busy} onRemove={() => void remove(file.id)} />)}
    </div>
  </article>;
}

export default memo(CloudClipboardEntryCard);
