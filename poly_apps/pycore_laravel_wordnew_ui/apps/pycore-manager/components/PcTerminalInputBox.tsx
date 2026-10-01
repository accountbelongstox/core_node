import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isTerminalImageFile, type PcTerminalImages } from './usePcTerminalImages';

type DraftStatus = 'saved' | 'saving' | 'error';

interface PcTerminalInputBoxProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  hasWindow: boolean;
  rows: number;
  draftStatus: DraftStatus;
  images: PcTerminalImages;
}

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(isTerminalImageFile);
}

/** Terminal message composer: text draft plus pasted, dropped or picked image attachments. */
export const PcTerminalInputBox: React.FC<PcTerminalInputBoxProps> = ({
  value, onChange, onSend, hasWindow, rows, draftStatus, images,
}) => {
  const { t } = useTranslation('pc');
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`space-y-2 rounded-xl ${dragging ? 'ring-1 ring-indigo-500' : ''}`}
      onDragOver={(event) => {
        if (!hasWindow || !Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        setDragging(false);
        const files = imageFiles(event.dataTransfer.files);
        if (!files.length) return;
        event.preventDefault();
        images.addFiles(files);
      }}
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onSend();
          }
        }}
        onPaste={(event) => {
          const files = imageFiles(event.clipboardData.files);
          if (!files.length) return;
          images.addFiles(files);
          if (!event.clipboardData.getData('text')) event.preventDefault();
        }}
        disabled={!hasWindow}
        rows={rows}
        placeholder={t('terminal.inputPlaceholder')}
        className="w-full resize-y rounded-xl border border-slate-500/20 bg-white/60 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-slate-950/40 dark:text-slate-100"
      />
      {images.items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.items.map((item) => (
            <li key={item.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-500/20 bg-slate-500/10">
              {item.previewUrl && <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />}
              {item.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/40">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-rose-900/60 p-1 text-center text-[9px] text-white" title={t(item.errorKey, item.errorParams)}>
                  {item.previewUrl ? (
                    <button type="button" onClick={() => images.retry(item.id)} title={t('terminal.images.retry')}>
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  ) : t(item.errorKey, item.errorParams)}
                </div>
              )}
              <button
                type="button"
                onClick={() => images.remove(item.id)}
                title={t('terminal.images.remove')}
                className="absolute right-0.5 top-0.5 rounded-full bg-slate-900/70 p-0.5 text-white hover:bg-slate-900"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        {hasWindow ? (
          <p className={`text-[10px] ${
            draftStatus === 'error' ? 'text-rose-500' : draftStatus === 'saving' ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {t(draftStatus === 'error' ? 'terminal.draftSaveFailed' : draftStatus === 'saving' ? 'terminal.draftSaving' : 'terminal.draftSaved')}
          </p>
        ) : <span />}
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          disabled={!hasWindow}
          title={t('terminal.images.attach')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          {images.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t('terminal.images.attach')}
        </button>
        <input
          ref={pickerRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            images.addFiles(imageFiles(event.target.files));
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
