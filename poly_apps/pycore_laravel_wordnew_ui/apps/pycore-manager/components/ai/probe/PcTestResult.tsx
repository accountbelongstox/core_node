/**
 * PcTestResult — renders one hub test outcome: banner, localized failure,
 * media (audio clip / image), the text output and the engine meta line. The
 * shape is read generically from the category's own result payload.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AiHubTestResult, EngineLoadStatusEntry } from '@/apps/pycore-manager/api';
import { PcBlobAudio } from '../../PcBlobMedia';
import { pcFailureMessage, pcTtsReasonText } from '../../../utils/pcErrorCodes';
import { aiHubReasonText } from '../../../utils/pcAiHubText';
import { formatElapsedMs } from '../../../utils/pcFormat';
import { PcEngineLoadLive } from './PcEngineLoadLive';

const COPY_FEEDBACK_MS = 1500;
const SPEECH_KINDS = ['tts', 'stt'];
const TEXT_KEYS = ['translated_text', 'text', 'output', 'response'] as const;
const META_KEYS = ['engine', 'provider', 'model', 'device', 'version'] as const;

type ResultRecord = Record<string, unknown>;

export interface PcEngineLoadSlot {
  entry: EngineLoadStatusEntry | null;
  longWait?: boolean;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

function textOutput(result: ResultRecord): string {
  for (const key of TEXT_KEYS) {
    const value = asText(result[key]);
    if (value) return value;
  }
  return '';
}

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { t } = useTranslation('pc');
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }).catch(() => undefined);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold pc-glass hover:bg-indigo-500/10 text-indigo-500">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? t('aiHub.test.copied') : t('aiHub.test.copy')}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 rounded-lg p-2 max-h-56 overflow-auto">
        {value || <span className="text-slate-400 italic">—</span>}
      </pre>
    </div>
  );
};

function failureText(outcome: AiHubTestResult, result: ResultRecord, fallback: string): string {
  if (outcome.boot?.state === 'blocked') {
    return aiHubReasonText(outcome.boot.reason_code, outcome.boot.reason_params, outcome.boot.reason) || fallback;
  }
  const code = asText(result.error_code);
  const params = (result.error_params ?? null) as Record<string, unknown> | null;
  return pcTtsReasonText(code, params, '')
    || pcFailureMessage({ error_code: code || undefined, error: asText(result.error) || outcome.error }, fallback);
}

export interface PcTestResultProps {
  running: boolean;
  outcome: AiHubTestResult | null;
  requestFailure: string | null;
  loadSlot?: PcEngineLoadSlot | null;
}

export const PcTestResult: React.FC<PcTestResultProps> = ({ running, outcome, requestFailure, loadSlot }) => {
  const { t } = useTranslation('pc');
  const result = (outcome?.result ?? {}) as ResultRecord;
  const ok = !!outcome?.ok;
  const speechId = SPEECH_KINDS.includes(outcome?.kind ?? '') ? asText(result.record_id) : '';
  const imageBase64 = asText(result.image_base64);
  const text = textOutput(result);
  const detail = asText(result.error) || outcome?.error || '';
  const meta = META_KEYS.map((key) => asText(result[key])).filter(Boolean);

  let banner = t('aiHub.test.running');
  let bannerClass = 'text-slate-500';
  let BannerIcon: React.FC<{ className?: string }> = Loader2;
  if (!running) {
    if (ok) {
      banner = t('aiHub.test.success');
      bannerClass = 'text-emerald-500';
      BannerIcon = Check;
    } else {
      banner = outcome ? failureText(outcome, result, t('aiHub.test.failed')) : (requestFailure || t('aiHub.test.failed'));
      bannerClass = 'text-rose-500';
      BannerIcon = AlertTriangle;
    }
  }

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-slate-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-[11px] font-semibold min-w-0 ${bannerClass}`}>
          <BannerIcon className={`w-3.5 h-3.5 shrink-0 ${running ? 'animate-spin' : ''}`} />
          <span className="break-words">{banner}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">{t('aiHub.test.result')}</span>
      </div>

      {running && loadSlot?.entry && loadSlot.entry.state !== 'idle' && <PcEngineLoadLive entry={loadSlot.entry} />}
      {running && !(loadSlot?.entry && loadSlot.entry.state !== 'idle') && (
        <p className="text-[11px] text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {loadSlot?.longWait ? t('aiHub.test.waitingLong') : t('aiHub.test.waiting')}
        </p>
      )}

      {!running && outcome && (
        <div className="space-y-2">
          {(meta.length > 0 || outcome.elapsed_ms != null) && (
            <div className="text-[10px] font-mono text-slate-400">
              {[...meta, formatElapsedMs(outcome.elapsed_ms)].join(' · ')}
            </div>
          )}
          {speechId && <PcBlobAudio controls path={pycoreApi.speechHistoryFileUrl(speechId)} className="w-full" />}
          {imageBase64 && (
            <img
              src={`data:${asText(result.mime) || 'image/png'};base64,${imageBase64}`}
              alt=""
              className="max-h-64 w-auto rounded-lg border border-slate-200/60 dark:border-slate-700/60"
            />
          )}
          {ok && (text || !imageBase64) && (
            <CopyRow label={t(`aiHub.test.output.${outcome.kind}`, { defaultValue: t('aiHub.test.output.default') })} value={text} />
          )}
          {!ok && detail && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-slate-500">{t('aiHub.test.detail')}</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-rose-600 dark:text-rose-400 max-h-40 overflow-auto">{detail}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
