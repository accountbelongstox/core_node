import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import type { CloudClipboardFile } from '../../core/contracts/CloudClipboardContract';
import type { CloudClipboardModel } from './CloudClipboardModel';
import { SYSTEM_CLIPBOARD_IMAGE_MIMES } from '../../core/browser/SystemClipboard';
import { offerBlobFile } from '../../core/browser/FileDownload';
import CloudClipboardCopyButton from './CloudClipboardCopyButton';

interface Props {
  model: CloudClipboardModel;
  entryId: string;
  file: CloudClipboardFile;
  onRemove: () => void;
  disabled: boolean;
}

const buttonClass = 'inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm disabled:opacity-40';

export default function CloudClipboardAttachment({ model, entryId, file, onRemove, disabled }: Props) {
  const { t } = useTranslation('cloudClipboard');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const preview = SYSTEM_CLIPBOARD_IMAGE_MIMES.has(file.mime_type);
  const fileUrl = model.api.fileUrl(entryId, file);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError(false);
    setUrl('');
    if (preview) {
      model.api.file(entryId, file.id).then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: file.mime_type }));
        setUrl(objectUrl);
      }).catch(() => { if (active) setError(true); });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [model, entryId, file.id, file.mime_type, preview, attempt]);

  const download = async (): Promise<void> => {
    try {
      offerBlobFile(file.original_name, await model.api.file(entryId, file.id));
    } catch {
      setError(true);
    }
  };

  return <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 min-w-0">
    {preview && (url ? <img src={url} alt={file.original_name} className="max-h-48 max-w-full rounded-lg object-contain" loading="lazy" />
      : <span className="text-xs text-slate-500">{t(error ? 'fileFailed' : 'fileLoading')}</span>)}
    <p className="text-sm break-all">{file.original_name} <span className="text-slate-500">({Math.ceil(file.size / 1024)} KB)</span></p>
    <p className="select-all break-all rounded-lg bg-slate-500/10 px-2 py-1 font-mono text-[11px] leading-snug text-slate-600 dark:text-slate-300"
      title={t(preview ? 'copyImageUrl' : 'copyFileUrl')}>{fileUrl}</p>
    <div className="flex gap-2 flex-wrap">
      {preview && <CloudClipboardCopyButton className={buttonClass} loadImage={async () => {
        const blob = await model.api.file(entryId, file.id);
        return new Blob([blob], { type: file.mime_type });
      }} />}
      <CloudClipboardCopyButton className={buttonClass} text={fileUrl} labelKey={preview ? 'copyImageUrl' : 'copyFileUrl'} />
      <button type="button" className={buttonClass} onClick={() => void download()}><Download size={14} />{t('download')}</button>
      <button type="button" className={buttonClass} disabled={disabled} onClick={onRemove}><Trash2 size={14} />{t('removeFile')}</button>
      {error && <button type="button" className={buttonClass} onClick={() => setAttempt((value) => value + 1)}>{t('retry')}</button>}
    </div>
  </div>;
}
