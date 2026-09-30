/**
 * PcTestPopup — the ONE test window for every hub model. The form comes from the
 * entry's `test_schema` (fields, defaults, options, visibility); the run goes
 * through `ui/ai_hub/test`, which records one history row per run. Nothing
 * engine-specific lives here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, Play, RefreshCw, Upload, X } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import {
  aiHubData, aiHubFailureCode, pycoreApi, usePcEngineLoadStatus,
} from '@/apps/pycore-manager/api';
import type { AiHubEntry, AiHubTestResult } from '@/apps/pycore-manager/api';
import { pcErrorCodeText } from '../../../utils/pcErrorCodes';
import { PC_ENGINE_LOAD_CATEGORIES, aiHubCategoryMeta } from '../../../utils/pcAiHubMeta';
import { renderTextToPng } from '../../../utils/pcOcrSample';
import { PcBootPill, PcRuntimePill } from '../PcModelPills';
import { PcTierBadge } from '../PcTierBadge';
import PcLivePanel from '../live/PcLivePanel';
import {
  PcTestFields, pcTestInitialValues, pcTestParams, type PcTestValue, type PcTestValues,
} from './PcTestFields';
import { PcTestResult } from './PcTestResult';

const ELAPSED_TICK_MS = 100;
const MS_PER_SECOND = 1000;
const OCR_CATEGORY = 'ocr';
const OCR_TEXT_KEY = 'ocr_text';
const OCR_IMAGE_KEY = 'image_data';
const TIMEOUT_PATTERN = /abort|timeout|timed out/i;

type Phase = 'idle' | 'run' | 'done';

interface PcTestPopupProps {
  entry: AiHubEntry;
  onClose: () => void;
}

export const PcTestPopup: React.FC<PcTestPopupProps> = ({ entry, onClose }) => {
  const { t } = useTranslation('pc');
  const schema = entry.test_schema ?? null;
  const isOcr = entry.category === OCR_CATEGORY;
  const meta = aiHubCategoryMeta(entry.category);
  const Icon = meta.Icon;

  const [values, setValues] = useState<PcTestValues>(() => pcTestInitialValues(schema));
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<AiHubTestResult | null>(null);
  const [requestFailure, setRequestFailure] = useState<string | null>(null);
  const [ocrOverride, setOcrOverride] = useState<string | null>(null);
  const startedRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const running = phase === 'run';
  const loadRelevant = running && PC_ENGINE_LOAD_CATEGORIES.includes(entry.category);
  const { getEngine } = usePcEngineLoadStatus(loadRelevant);
  const loadSlot = loadRelevant ? { entry: getEngine(entry.id), longWait: !!schema?.hints?.long_wait } : null;

  const ocrText = String(values[OCR_TEXT_KEY] ?? '');
  const ocrPreview = useMemo(() => (isOcr ? (ocrOverride ?? renderTextToPng(ocrText)) : ''), [isOcr, ocrOverride, ocrText]);

  useEffect(() => {
    if (!running) return undefined;
    startedRef.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((performance.now() - startedRef.current) / MS_PER_SECOND), ELAPSED_TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setValue = useCallback((key: string, value: PcTestValue) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => setOcrOverride(String(reader.result || ''));
    reader.readAsDataURL(file);
  }, []);

  const onPaste = useCallback((event: React.ClipboardEvent) => {
    if (!isOcr) return;
    const files = event.clipboardData?.files;
    for (let index = 0; files && index < files.length; index += 1) {
      const file = files[index];
      if (file && file.type.startsWith('image/')) {
        event.preventDefault();
        readFile(file);
        return;
      }
    }
  }, [isOcr, readFile]);

  const run = useCallback(async () => {
    setPhase('run');
    setOutcome(null);
    setRequestFailure(null);
    const params = pcTestParams(schema, values);
    if (isOcr) params[OCR_IMAGE_KEY] = ocrPreview;
    try {
      const answer = await pycoreApi.runAiHubTest(entry, params);
      const data = aiHubData<AiHubTestResult>(answer);
      if (data) setOutcome(data);
      else setRequestFailure(pcErrorCodeText(aiHubFailureCode(answer)));
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : '';
      setRequestFailure(TIMEOUT_PATTERN.test(raw) ? t('aiHub.test.timeout') : t('common.requestFailed'));
    }
    setPhase('done');
  }, [schema, values, isOcr, ocrPreview, entry, t]);

  const blocked = entry.boot.state === 'blocked';
  const timeLabel = running
    ? `${elapsed.toFixed(1)}s`
    : outcome ? `${(outcome.elapsed_ms / MS_PER_SECOND).toFixed(1)}s` : '—';

  return (
    <Portal>
      <div
        className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP} animate-in fade-in duration-200`}
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        onPaste={onPaste}>
        <div className="relative w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/30 border border-indigo-500/25 flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
          <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-indigo-500/25 bg-gradient-to-r from-indigo-500/12 via-violet-500/6 to-transparent">
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/10 ${meta.accent}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span className={meta.accent}>{t(`aiHub.categories.${entry.category}`, { defaultValue: entry.category })}</span>
                <span className="text-slate-400 font-normal">{t('aiHub.test.title')}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-[10px] font-mono text-slate-600 dark:text-slate-300">{entry.id}</span>
                <PcBootPill boot={entry.boot} />
                <PcRuntimePill state={entry.runtime_state} />
                <PcTierBadge tier={entry.tier} />
              </div>
              {entry.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{entry.note}</p>}
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-500/10 text-slate-400" title={t('common.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <PcTestFields schema={schema} values={values} onChange={setValue} />

            {isOcr && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold pc-glass hover:bg-emerald-500/10 text-emerald-500 inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" /> {t('aiHub.test.upload')}
                  </button>
                  {ocrOverride && (
                    <button
                      type="button"
                      onClick={() => setOcrOverride(null)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold pc-glass hover:bg-slate-500/10 text-slate-500 inline-flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> {t('aiHub.test.resetSample')}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) readFile(file);
                      event.target.value = '';
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">{t('aiHub.test.ocrHint')}</p>
                {ocrPreview && (
                  <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-white flex items-center justify-center min-h-[80px]">
                    <img src={ocrPreview} alt="" className="block max-h-48 w-auto" />
                  </div>
                )}
              </div>
            )}

            {entry.capabilities.live && (
              <PcLivePanel variant={entry.capabilities.live} showSystem={false} embedded />
            )}

            {phase !== 'idle' && (
              <PcTestResult running={running} outcome={outcome} requestFailure={requestFailure} loadSlot={loadSlot} />
            )}
          </div>

          <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-t border-indigo-500/25">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5" /> {timeLabel}
            </div>
            {blocked && <span className="text-[11px] text-rose-500">{t('aiHub.test.blocked')}</span>}
            <button
              type="button"
              onClick={() => { void run(); }}
              disabled={running}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? t('aiHub.test.running') : t('aiHub.test.run')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default PcTestPopup;
