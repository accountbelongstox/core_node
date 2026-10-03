/** OCR: image drop / paste / pick stage with a scanning overlay and the recognized text beside it. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, Eraser, FileImage, ImagePlus, ScanText } from 'lucide-react';
import { downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import { callToolApi, ToolRunError, useToolRun } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, controlClass, CopyBtn, Metric, Notice, OpsPage, OpsStatusBar, Panel, Spinner } from './opsKit';
import { useMountedRef, useRemote } from './opsHooks';
import { formatBytes, pollUntil } from './opsLogic';
import type { OcrEnginesData, OcrRecognizeData } from './opsTypes';

interface OcrResult {
  text: string;
  engine: string;
  latencyMs: number | null;
}

const DEFAULT_MODELS = ['general', 'scene', 'doc', 'number', 'english', 'chinese_traditional'];
const POLL_INTERVAL_MS = 5000;
const POLL_ATTEMPTS = 24;

const OcrWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const previous = lastRun?.input as { modelType?: string } | null | undefined;
  const mounted = useMountedRef();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [model, setModel] = useState(previous?.modelType ?? 'general');
  const [edited, setEdited] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'queued'>('idle');
  const [attempt, setAttempt] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const { result, error, running, run, reset } = useToolRun<OcrResult>(tool.id, variant);
  const engines = useRemote(() => callToolApi<OcrEnginesData>('mcpV1.getOcrEngines'), []);
  const maxBytes = engines.data?.image_max_bytes ?? null;
  const models = engines.data?.model_types?.length ? engines.data.model_types : DEFAULT_MODELS;

  useEffect(() => { if (result) setEdited(result.text); }, [result]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const accept = useCallback((candidate: File | undefined | null): void => {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/')) {
      setFileError(t('toolsOps.ocr.not_image'));
      return;
    }
    if (maxBytes && candidate.size > maxBytes) {
      setFileError(t('toolsOps.ocr.too_large', { size: formatBytes(candidate.size), limit: formatBytes(maxBytes) }));
      return;
    }
    setFileError(null);
    setFile(candidate);
    setPreviewUrl(URL.createObjectURL(candidate));
    setEdited('');
    reset();
  }, [maxBytes, reset, t]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const image = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'));
      if (image) accept(image);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [accept]);

  const recognize = async (): Promise<void> => {
    if (!file || running) return;
    await run({ fileName: file.name, size: file.size, modelType: model }, async () => {
      setPhase('sending');
      setAttempt(0);
      try {
        const outcome = await pollUntil(
          () => callToolApi<OcrRecognizeData>(tool.apiMethod, { image: file, model_type: model }),
          (data) => typeof data?.text === 'string' || data?.success === false,
          {
            intervalMs: POLL_INTERVAL_MS,
            maxAttempts: POLL_ATTEMPTS,
            isCancelled: () => !mounted.current,
            onTick: (data, count) => { setAttempt(count); if (typeof data?.text !== 'string') setPhase('queued'); },
          },
        );
        const data = outcome.value;
        if (data?.success === false) throw new ToolRunError('remote_failed', { message: data.error ?? '' });
        if (!outcome.done || typeof data?.text !== 'string') throw new ToolRunError('remote_failed', { message: outcome.cancelled ? '' : t('toolsOps.ocr.queue_timeout') });
        return { text: data.text, engine: data.engine ?? '', latencyMs: data.latency_ms ?? null };
      } finally {
        if (mounted.current) setPhase('idle');
      }
    });
  };

  const clear = (): void => {
    setFile(null);
    setPreviewUrl('');
    setEdited('');
    setFileError(null);
    reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const lines = edited ? edited.split('\n').filter((line) => line.trim() !== '').length : 0;
  const statusText = running
    ? (phase === 'queued' ? t('toolsOps.ocr.queued', { attempt, max: POLL_ATTEMPTS }) : t('toolsOps.ocr.sending'))
    : result ? t('toolsOps.ocr.done', { engine: result.engine || t('toolsOps.ocr.engine_unknown'), ms: result.latencyMs ?? 0 })
      : t('toolsOps.ocr.ready');

  return (
    <OpsPage>
      <OpsStatusBar accent="fuchsia" mode="server" updatedAt={engines.updatedAt} loading={engines.loading} onRefresh={() => void engines.reload()}>{statusText}</OpsStatusBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('toolsOps.ocr.stage')} icon={FileImage} accent="fuchsia" actions={file ? <Btn size="sm" icon={Eraser} onClick={clear}>{t('uiTools.common.clear')}</Btn> : undefined}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files?.[0]); }}
            className={`relative flex min-h-[18rem] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-3 transition-colors ${
              dragging ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-500/10' : 'border-slate-300 hover:border-fuchsia-400 dark:border-slate-600'
            }`}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt={file?.name ?? ''} className="max-h-[22rem] w-auto max-w-full rounded-lg object-contain" />
                {running && (
                  <motion.div
                    className="pointer-events-none absolute inset-x-3 h-0.5 bg-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.9)]"
                    initial={{ top: '4%' }}
                    animate={{ top: '94%' }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center text-sm text-slate-400">
                <ImagePlus className="h-10 w-10" />
                <p>{t('toolsOps.ocr.drop_hint')}</p>
                <p className="text-[11px]">{t('toolsOps.ocr.paste_hint')}</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => accept(event.target.files?.[0])} />
          </div>
          {file && <p className="mt-2 truncate text-[11px] text-slate-400">{file.name} · {formatBytes(file.size)}</p>}
          {fileError && <Notice tone="warn" className="mt-3">{fileError}</Notice>}

          <div className="mt-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('toolsOps.ocr.model')}</p>
            <Chips accent="fuchsia" value={model} onChange={setModel} options={models.map((id) => ({ value: id, label: t(`uiTools.ocr.model_${id}`, { defaultValue: id }) }))} />
            <Btn variant="primary" accent="fuchsia" icon={ScanText} loading={running} onClick={() => void recognize()} disabled={!file} className="w-full">
              {running ? (phase === 'queued' ? t('toolsOps.ocr.queued', { attempt, max: POLL_ATTEMPTS }) : t('toolsOps.ocr.sending')) : t('toolsOps.ocr.recognize')}
            </Btn>
          </div>
        </Panel>

        <Panel
          title={t('toolsOps.ocr.text')}
          icon={ScanText}
          accent="fuchsia"
          actions={(
            <>
              <CopyBtn text={edited} accent="fuchsia" />
              <Btn size="sm" icon={Download} onClick={() => downloadAsFile(edited, `ocr_${Date.now()}.txt`, 'text/plain')} disabled={!edited}>{t('uiTools.common.download')}</Btn>
            </>
          )}
        >
          {running ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-sm text-slate-400"><Spinner className="h-6 w-6" />{phase === 'queued' ? t('toolsOps.ocr.queued_hint') : t('toolsOps.ocr.sending')}</div>
          ) : (
            <textarea
              value={edited}
              onChange={(event) => setEdited(event.target.value)}
              placeholder={result && !result.text ? t('toolsOps.ocr.no_text') : t('toolsOps.ocr.text_placeholder')}
              className={`${controlClass('fuchsia')} min-h-[18rem] resize-y font-mono`}
              rows={12}
            />
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label={t('toolsOps.ocr.stat_chars')} value={edited.length} />
            <Metric label={t('toolsOps.ocr.stat_lines')} value={lines} />
            <Metric label={t('toolsOps.ocr.stat_limit')} value={maxBytes ? formatBytes(maxBytes, 0) : '-'} />
          </div>
        </Panel>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {engines.error && <Notice tone="warn">{engines.error}</Notice>}
    </OpsPage>
  );
};

export default OcrWorkbench;
