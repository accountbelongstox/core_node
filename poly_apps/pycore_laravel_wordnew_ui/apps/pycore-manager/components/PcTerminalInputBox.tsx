import React, { useCallback, useRef, useState } from 'react';
import { Aperture, Camera, Check, ClipboardPaste, Copy, CornerDownLeft, FileAudio, ImagePlus, Keyboard, Loader2, Mic, RefreshCw, ScanText, Shrink, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../core/persistence';
import { formatBytes } from '../../../core/utils/formatBytes';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { isTerminalAttachmentFile, type PcTerminalImage, type PcTerminalImages } from './usePcTerminalImages';
import { usePcVoiceRecorder, type PcVoiceRecorderError } from './usePcVoiceRecorder';
import { usePcTextInputSession } from '../persistence/PcUiSessionDom';
import { PcImageLightbox } from './PcAiShared';
import { useIsMobile } from '../hooks/useIsMobile';
import { isNativeAppShell } from '../../../core/network/NativeShell';
import { isDesktopAppShell } from '../../../core/network/DesktopShell';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { readPcClipboard } from '../utils/pcClipboardRead';
import type { PcUiSessionInput } from '../persistence/PcUiSessionStore';

const IME_PROCESS_KEY_CODE = 229;

type DraftStatus = 'saved' | 'saving' | 'error';
type ComposerMode = 'text' | 'voice';
type PullHint = '' | 'pull.empty' | 'pull.permission' | 'pull.unsupported' | 'liveScreenshot.failed' | 'camera.failed' | 'camera.permission';

const PULL_HINT_MS = 4000;
const COPIED_FLASH_MS = 1500;
const CAMERA_CANCELLED = /cancel/i;
const CAMERA_DENIED = /denied|permission/i;

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
  actions?: React.ReactNode;
  /** Start of the toolbar row, before the voice controls. */
  leading?: React.ReactNode;
  /** Centered in the toolbar row, between the voice controls and the actions. */
  sendButton?: React.ReactNode;
  session?: PcTerminalInputSession;
  /** Live screenshot of the selected terminal window, null when it could not be captured. */
  pullScreenshot?: () => Promise<File | null>;
}

function attachmentFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(isTerminalAttachmentFile);
}

function readComposerMode(): ComposerMode {
  return StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_COMPOSER_MODE) === 'voice' ? 'voice' : 'text';
}

const VOICE_ERROR_KEYS: Record<PcVoiceRecorderError, string> = {
  denied: 'terminal.voice.micDenied',
  insecure: 'terminal.voice.micInsecure',
  failed: 'terminal.voice.failed',
};

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Terminal message composer: text draft plus pasted, dropped or picked attachments. Voice mode records a
 * message straight from the microphone (native plugin in the app, MediaRecorder in browsers); the
 * recording is sent as a file path with optional images and text.
 */
export const PcTerminalInputBox: React.FC<PcTerminalInputBoxProps> = ({
  value, onChange, onSend, hasWindow, rows, draftStatus, images, actions, leading, sendButton, session, pullScreenshot,
}) => {
  const { t } = useTranslation('pc');
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const recorderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compressionId, setCompressionId] = useState<string | null>(null);
  const [mode, setMode] = useState<ComposerMode>(readComposerMode);
  const [pullHint, setPullHint] = useState<PullHint>('');
  const [pulling, setPulling] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [ocrId, setOcrId] = useState<string | null>(null);
  const [ocrCopied, setOcrCopied] = useState(false);
  const pullHintTimer = useRef<number | undefined>(undefined);
  const ocrCopiedTimer = useRef<number | undefined>(undefined);
  const cameraSupported = isNativeAppShell() && !isDesktopAppShell();
  const isMobile = useIsMobile();
  const toggleMode = () => {
    const next: ComposerMode = mode === 'voice' ? 'text' : 'voice';
    setMode(next);
    StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_COMPOSER_MODE, next);
  };
  const addRecording = useCallback((file: File) => images.addFiles([file]), [images]);
  const recorder = usePcVoiceRecorder(addRecording);
  const imageItems = images.items.filter((item) => item.kind === 'image');
  const audioItems = images.items.filter((item) => item.kind === 'audio');
  const failedItems = images.items.filter((item) => item.status === 'error');
  const errorDetailLines = (item: PcTerminalImage): string[] => {
    const detail = item.errorDetail;
    const lines = [t('terminal.images.detail.file', {
      name: item.file.name,
      type: item.file.type || t('terminal.images.detail.unknownType'),
      size: formatBytes(item.file.size),
    })];
    if (!detail) return lines;
    lines.push(t('terminal.images.detail.code', { code: detail.code }));
    if (detail.httpStatus !== null) lines.push(t('terminal.images.detail.http', { status: detail.httpStatus }));
    if (detail.message) lines.push(t('terminal.images.detail.message', { message: detail.message }));
    if (detail.receivedBytes !== null) lines.push(t('terminal.images.detail.received', { size: formatBytes(detail.receivedBytes) }));
    if (detail.maxBytes !== null) lines.push(t('terminal.images.detail.max', { size: formatBytes(detail.maxBytes) }));
    if (detail.headHex) lines.push(t('terminal.images.detail.head', { head: detail.headHex }));
    return lines;
  };
  const previewItem = imageItems.find((item) => item.id === previewId && item.previewUrl) ?? null;
  const compressionItem = imageItems.find((item) => item.id === compressionId && item.compression) ?? null;
  const ocrItem = imageItems.find((item) => item.id === ocrId && item.ocr) ?? null;
  const compressionText = (item: PcTerminalImage): string => {
    const info = item.compression!;
    return t('terminal.images.compression.detail', {
      name: item.file.name,
      original: `${info.originalWidth}×${info.originalHeight} · ${formatBytes(info.originalBytes)}`,
      current: `${info.width}×${info.height} · ${formatBytes(info.bytes)}`,
    });
  };
  const record = () => {
    if (recorder.recording) recorder.stop();
    else void recorder.start();
  };
  const showPullHint = (hint: PullHint) => {
    window.clearTimeout(pullHintTimer.current);
    setPullHint(hint);
    if (hint) pullHintTimer.current = window.setTimeout(() => setPullHint(''), PULL_HINT_MS);
  };
  const pullImages = async () => {
    showPullHint('');
    setPulling(true);
    const read = await readPcClipboard();
    setPulling(false);
    if (read.status === 'ok' && read.images.length) {
      images.addFiles(read.images.filter(isTerminalAttachmentFile));
      return;
    }
    if (isMobile || isNativeAppShell()) pickerRef.current?.click();
    else showPullHint(read.status === 'ok' ? 'pull.empty' : `pull.${read.status}`);
  };
  const pullLiveScreenshot = async () => {
    if (!pullScreenshot) return;
    showPullHint('');
    setCapturing(true);
    const file = await pullScreenshot().catch(() => null);
    setCapturing(false);
    if (file) images.addFiles([file]);
    else showPullHint('liveScreenshot.failed');
  };
  const takeCameraPhoto = async () => {
    showPullHint('');
    setShooting(true);
    try {
      const { capCamera } = await import('@/apps/wordnew/platform/capabilities/CapCamera');
      const photo = await capCamera.takePhoto({ quality: 90 });
      if (photo.blob) {
        const extension = photo.format === 'jpeg' ? 'jpg' : photo.format;
        images.addFiles([new File([photo.blob], `camera-${Date.now()}.${extension}`, { type: photo.blob.type || 'image/jpeg' })]);
      }
    } catch (error) {
      const message = String((error as { message?: string } | null)?.message ?? error);
      if (!CAMERA_CANCELLED.test(message)) showPullHint(CAMERA_DENIED.test(message) ? 'camera.permission' : 'camera.failed');
    } finally {
      setShooting(false);
    }
  };
  const copyOcrText = async (text: string) => {
    if (!(await copyTextToSystemClipboard(text))) return;
    window.clearTimeout(ocrCopiedTimer.current);
    setOcrCopied(true);
    ocrCopiedTimer.current = window.setTimeout(() => setOcrCopied(false), COPIED_FLASH_MS);
  };
  const { elementRef, cancelRestore } = usePcTextInputSession({
    slot: session?.slot ?? '',
    enabled: Boolean(session) && hasWindow,
    value,
    restore: session?.restore ?? null,
    onRestored: session?.onRestored ?? (() => undefined),
    onSnapshot: session?.onSnapshot ?? (() => undefined),
  });

  const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 disabled:opacity-50';

  return (
    <div
      className={`rounded-xl border bg-white/60 focus-within:ring-1 focus-within:ring-indigo-500 dark:bg-slate-950/40 ${
        dragging ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-500/20'
      } ${hasWindow ? '' : 'opacity-50'}`}
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
      <div className="flex items-start gap-1.5 px-1.5 pt-1.5">
        {imageItems.length > 0 && (
          <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-contain">
            {imageItems.map((item) => (
              <li key={item.id} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-500/20 bg-slate-500/10">
                {item.previewUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewId(item.id)}
                    title={t('terminal.images.preview')}
                    aria-label={t('terminal.images.preview')}
                    className="block h-full w-full cursor-zoom-in"
                  >
                    <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                  </button>
                )}
                {item.compression && (
                  <button
                    type="button"
                    onClick={() => setCompressionId(compressionId === item.id ? null : item.id)}
                    title={compressionText(item)}
                    aria-label={t('terminal.images.compression.badge')}
                    className="absolute bottom-0.5 left-0.5 rounded-full bg-emerald-600/85 p-0.5 text-white hover:bg-emerald-600"
                  >
                    <Shrink className="h-3 w-3" />
                  </button>
                )}
                {item.ocr && (
                  <button
                    type="button"
                    onClick={() => setOcrId(ocrId === item.id ? null : item.id)}
                    title={t(`terminal.images.ocr.badge.${item.ocr.status}`)}
                    aria-label={t('terminal.images.ocr.badge.done')}
                    className={`absolute bottom-0.5 right-0.5 rounded-full p-0.5 text-white ${
                      item.ocr.status === 'error' ? 'bg-rose-600/90' : item.ocr.status === 'empty' ? 'bg-slate-600/85' : 'bg-indigo-600/90'
                    }`}
                  >
                    {item.ocr.status === 'running' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ScanText className="h-2.5 w-2.5" />}
                  </button>
                )}
                {item.status === 'compressing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40" title={t('terminal.images.compression.running')}>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
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
        <p
          className={`ml-auto min-w-0 max-w-[60%] shrink truncate pt-0.5 text-right text-[10px] ${
            recorder.error || pullHint || draftStatus === 'error'
              ? 'text-rose-500'
              : draftStatus === 'saving' ? 'text-amber-500' : 'text-emerald-500'
          }`}
          title={recorder.error ? t(VOICE_ERROR_KEYS[recorder.error]) : undefined}
        >
          {recorder.error
            ? t(VOICE_ERROR_KEYS[recorder.error])
            : pullHint
              ? t(`terminal.images.${pullHint}`)
              : hasWindow
              ? t(draftStatus === 'error' ? 'terminal.draftSaveFailed' : draftStatus === 'saving' ? 'terminal.draftSaving' : 'terminal.draftSaved')
              : ''}
        </p>
      </div>
      {ocrItem?.ocr && (
        <div className="mx-1.5 mt-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-1.5">
          <div className="flex items-center gap-1">
            <ScanText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">{t('terminal.images.ocr.title')}</span>
            {ocrItem.ocr.status === 'done' && (
              <>
                <button
                  type="button"
                  onClick={() => { void copyOcrText(ocrItem.ocr!.text); }}
                  title={t('terminal.images.ocr.copy')}
                  aria-label={t('terminal.images.ocr.copy')}
                  className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-indigo-600 hover:bg-indigo-500/15 dark:text-indigo-300"
                >
                  {ocrCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {t(ocrCopied ? 'terminal.images.ocr.copied' : 'terminal.images.ocr.copy')}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value ? `${value}\n${ocrItem.ocr!.text}` : ocrItem.ocr!.text)}
                  title={t('terminal.images.ocr.insert')}
                  aria-label={t('terminal.images.ocr.insert')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-indigo-600 hover:bg-indigo-500/15 dark:text-indigo-300"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setOcrId(null)}
              title={t('terminal.images.ocr.close')}
              aria-label={t('terminal.images.ocr.close')}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-500/15"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {ocrItem.ocr.status === 'done' ? (
            <pre className="mt-1 max-h-40 select-text overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-snug text-slate-800 dark:text-slate-100">{ocrItem.ocr.text}</pre>
          ) : (
            <p className="mt-1 select-text break-words text-[11px] leading-snug text-slate-600 dark:text-slate-300">
              {ocrItem.ocr.status === 'running'
                ? t('terminal.images.ocr.running')
                : ocrItem.ocr.status === 'empty'
                  ? t('terminal.images.ocr.empty')
                  : t('terminal.images.ocr.failed', { code: ocrItem.ocr.errorCode })}
            </p>
          )}
        </div>
      )}
      {audioItems.length > 0 && (
        <ul className="space-y-1 px-1.5 pt-1.5" aria-label={t('terminal.voice.recordings')}>
          {audioItems.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 rounded-lg bg-slate-500/10 py-0.5 pl-1.5 pr-0.5">
              <Mic className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <audio src={item.previewUrl} controls preload="metadata" className="h-7 min-w-0 flex-1" />
              <span
                className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400"
                title={t(item.storedBytes === null ? 'terminal.voice.sizeLocal' : 'terminal.voice.sizeStored')}
              >
                {formatBytes(item.storedBytes ?? item.file.size)}
              </span>
              {item.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-500" />}
              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={() => images.retry(item.id)}
                  title={t(item.errorKey, item.errorParams)}
                  aria-label={t('terminal.images.retry')}
                  className="shrink-0 rounded p-1 text-rose-500 hover:bg-rose-500/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => images.remove(item.id)}
                title={t('terminal.images.remove')}
                aria-label={t('terminal.images.remove')}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {compressionItem && (
        <p className="mx-1.5 mt-1.5 select-text break-all rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] leading-snug text-emerald-700 dark:text-emerald-300">
          {compressionText(compressionItem)}
        </p>
      )}
      {failedItems.length > 0 && (
        <ul className="space-y-1 px-1.5 pt-1.5">
          {failedItems.map((item) => (
            <li key={item.id} className="select-text break-all rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] leading-snug text-rose-600 dark:text-rose-300">
              <p className="font-semibold">{t(item.errorKey, item.errorParams)}</p>
              <p>{errorDetailLines(item).join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={elementRef}
        data-terminal-composer=""
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPointerDown={cancelRestore}
        onKeyDown={(event) => {
          cancelRestore();
          if (event.key !== 'Enter') return;
          const composing = event.nativeEvent.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
          const plainEnter = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
          if (composing || (!(event.ctrlKey || event.metaKey) && !(plainEnter && !isMobile))) return;
          event.preventDefault();
          onSend();
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
        className="block w-full resize-y bg-transparent px-3 pb-1 pt-1 text-sm text-slate-800 focus:outline-none dark:text-slate-100"
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 px-1.5 pb-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {leading}
          {mode === 'voice' && (
            <>
              <button
                type="button"
                onClick={record}
                disabled={!hasWindow}
                title={recorder.recording ? undefined : t('terminal.voice.record')}
                aria-label={recorder.recording
                  ? t('terminal.voice.stop', { duration: formatDuration(recorder.elapsedSeconds) })
                  : t('terminal.voice.record')}
                className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  recorder.recording ? 'animate-pulse bg-rose-600 hover:bg-rose-500' : 'w-8 bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {recorder.recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
                {recorder.recording && <span className="font-mono">{formatDuration(recorder.elapsedSeconds)}</span>}
              </button>
              {!recorder.recording && (
                <button
                  type="button"
                  onClick={() => recorderInputRef.current?.click()}
                  disabled={!hasWindow}
                  title={t('terminal.voice.systemRecorder')}
                  aria-label={t('terminal.voice.systemRecorder')}
                  className={iconButton}
                >
                  <FileAudio className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
        {sendButton ?? <span />}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={toggleMode}
            disabled={!hasWindow || recorder.recording}
            title={t(mode === 'voice' ? 'terminal.voice.switchToText' : 'terminal.voice.switchToVoice')}
            aria-label={t(mode === 'voice' ? 'terminal.voice.switchToText' : 'terminal.voice.switchToVoice')}
            aria-pressed={mode === 'voice'}
            className={iconButton}
          >
            {mode === 'voice' ? <Keyboard className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            disabled={!hasWindow}
            title={t('terminal.images.attach')}
            aria-label={t('terminal.images.attach')}
            className={iconButton}
          >
            {images.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
          {cameraSupported && (
            <button
              type="button"
              onClick={() => { void takeCameraPhoto(); }}
              disabled={!hasWindow || shooting}
              title={t('terminal.images.camera.action')}
              aria-label={t('terminal.images.camera.action')}
              className={iconButton}
            >
              {shooting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Aperture className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => { void pullImages(); }}
            disabled={!hasWindow || pulling}
            title={t('terminal.images.pull.action')}
            aria-label={t('terminal.images.pull.action')}
            className={iconButton}
          >
            {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
          </button>
          {pullScreenshot && (
            <button
              type="button"
              onClick={() => { void pullLiveScreenshot(); }}
              disabled={!hasWindow || capturing}
              title={t('terminal.images.liveScreenshot.action')}
              aria-label={t('terminal.images.liveScreenshot.action')}
              className={iconButton}
            >
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          )}
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
          {actions}
        </div>
      </div>
      <PcImageLightbox
        open={Boolean(previewItem)}
        src={previewItem?.previewUrl ?? null}
        alt={previewItem?.file.name}
        caption={previewItem && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{previewItem.file.name}</p>}
        closeLabel={t('terminal.images.closePreview')}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
};
