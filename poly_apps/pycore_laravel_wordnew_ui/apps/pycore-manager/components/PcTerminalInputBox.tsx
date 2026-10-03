import React, { useCallback, useRef, useState } from 'react';
import { ImagePlus, Keyboard, Loader2, Mic, RefreshCw, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { isTerminalAttachmentFile, type PcTerminalImages } from './usePcTerminalImages';
import { usePcVoiceRecorder } from './usePcVoiceRecorder';
import { usePcTextInputSession } from '../persistence/PcUiSessionDom';
import type { PcUiSessionInput } from '../persistence/PcUiSessionStore';

type DraftStatus = 'saved' | 'saving' | 'error';
type ComposerMode = 'text' | 'voice';

export interface PcTerminalInputSession {
  slot: string;
  restore: PcUiSessionInput | null;
  onRestored: () => void;
  onSnapshot: (input: PcUiSessionInput) => void;
}

interface PcTerminalInputBoxProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  hasWindow: boolean;
  rows: number;
  draftStatus: DraftStatus;
  images: PcTerminalImages;
  session?: PcTerminalInputSession;
}

function attachmentFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(isTerminalAttachmentFile);
}

function readComposerMode(): ComposerMode {
  return StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_COMPOSER_MODE) === 'voice' ? 'voice' : 'text';
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Terminal message composer: text draft plus pasted, dropped or picked attachments. Voice mode records a
 * message (in page where the browser allows the microphone, else with the system recorder app); the
 * recording is sent as a file path with optional images and text.
 */
export const PcTerminalInputBox: React.FC<PcTerminalInputBoxProps> = ({
  value, onChange, onSend, hasWindow, rows, draftStatus, images, session,
}) => {
  const { t } = useTranslation('pc');
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const recorderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<ComposerMode>(readComposerMode);
  const toggleMode = () => {
    const next: ComposerMode = mode === 'voice' ? 'text' : 'voice';
    setMode(next);
    StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_COMPOSER_MODE, next);
  };
  const addRecording = useCallback((file: File) => images.addFiles([file]), [images]);
  const recorder = usePcVoiceRecorder(addRecording);
  const imageItems = images.items.filter((item) => item.kind === 'image');
  const audioItems = images.items.filter((item) => item.kind === 'audio');
  const record = () => {
    if (recorder.recording) recorder.stop();
    else if (recorder.available) void recorder.start();
    else recorderInputRef.current?.click();
  };
  const { elementRef, cancelRestore } = usePcTextInputSession({
    slot: session?.slot ?? '',
    enabled: Boolean(session) && hasWindow,
    value,
    restore: session?.restore ?? null,
    onRestored: session?.onRestored ?? (() => undefined),
    onSnapshot: session?.onSnapshot ?? (() => undefined),
  });

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
        const files = attachmentFiles(event.dataTransfer.files);
        if (!files.length) return;
        event.preventDefault();
        images.addFiles(files);
      }}
    >
      {mode === 'voice' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={record}
            disabled={!hasWindow}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              recorder.recording ? 'animate-pulse bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recorder.recording
              ? t('terminal.voice.stop', { duration: formatDuration(recorder.elapsedSeconds) })
              : t('terminal.voice.record')}
          </button>
          {recorder.available && !recorder.recording && (
            <button
              type="button"
              onClick={() => recorderInputRef.current?.click()}
              disabled={!hasWindow}
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-500/20 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-500/10 disabled:opacity-50 dark:text-slate-300"
            >
              {t('terminal.voice.systemRecorder')}
            </button>
          )}
          {recorder.error && (
            <p className="w-full text-[11px] text-rose-500">
              {t(recorder.error === 'denied' ? 'terminal.voice.micDenied' : 'terminal.voice.failed')}
            </p>
          )}
        </div>
      )}
      {audioItems.length > 0 && (
        <ul className="space-y-1.5" aria-label={t('terminal.voice.recordings')}>
          {audioItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-500/5 p-1.5">
              <Mic className="h-4 w-4 shrink-0 text-indigo-500" />
              <audio src={item.previewUrl} controls preload="metadata" className="h-8 min-w-0 flex-1" />
              {item.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />}
              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={() => images.retry(item.id)}
                  title={t(item.errorKey, item.errorParams)}
                  aria-label={t('terminal.images.retry')}
                  className="shrink-0 rounded p-1 text-rose-500 hover:bg-rose-500/10"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => images.remove(item.id)}
                title={t('terminal.images.remove')}
                aria-label={t('terminal.images.remove')}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <textarea
          ref={elementRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPointerDown={cancelRestore}
          onKeyDown={(event) => {
            cancelRestore();
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onSend();
            }
          }}
          onPaste={(event) => {
            const files = attachmentFiles(event.clipboardData.files);
            if (!files.length) return;
            images.addFiles(files);
            if (!event.clipboardData.getData('text')) event.preventDefault();
          }}
          disabled={!hasWindow}
          rows={mode === 'voice' ? Math.min(rows, 2) : rows}
          placeholder={t(mode === 'voice' ? 'terminal.voice.textPlaceholder' : 'terminal.inputPlaceholder')}
          className="block w-full resize-y rounded-xl border border-slate-500/20 bg-white/60 pb-11 pt-2 pl-3 pr-14 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-slate-950/40 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={toggleMode}
          disabled={!hasWindow || recorder.recording}
          title={t(mode === 'voice' ? 'terminal.voice.switchToText' : 'terminal.voice.switchToVoice')}
          aria-label={t(mode === 'voice' ? 'terminal.voice.switchToText' : 'terminal.voice.switchToVoice')}
          aria-pressed={mode === 'voice'}
          className="absolute bottom-2.5 right-14 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 shadow-sm backdrop-blur hover:bg-indigo-500/25 disabled:opacity-50"
        >
          {mode === 'voice' ? <Keyboard className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          disabled={!hasWindow}
          title={t('terminal.images.attach')}
          aria-label={t('terminal.images.attach')}
          className="absolute bottom-2.5 right-5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 shadow-sm backdrop-blur hover:bg-indigo-500/25 disabled:opacity-50"
        >
          {images.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        {imageItems.length > 0 && (
          <ul className="absolute bottom-12 right-5 top-2 flex w-10 flex-col gap-1.5 overflow-y-auto overscroll-contain">
            {imageItems.map((item) => (
              <li key={item.id} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-500/20 bg-slate-500/10">
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
      </div>
      <div className="flex items-center gap-2">
        {hasWindow ? (
          <p className={`text-[10px] ${
            draftStatus === 'error' ? 'text-rose-500' : draftStatus === 'saving' ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {t(draftStatus === 'error' ? 'terminal.draftSaveFailed' : draftStatus === 'saving' ? 'terminal.draftSaving' : 'terminal.draftSaved')}
          </p>
        ) : <span />}
        <input
          ref={pickerRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            images.addFiles(attachmentFiles(event.target.files));
            event.target.value = '';
          }}
        />
        <input
          ref={recorderInputRef}
          type="file"
          accept="audio/*"
          capture
          hidden
          onChange={(event) => {
            images.addFiles(attachmentFiles(event.target.files));
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
