/**
 * Wordnew's compute entry: the one scheduler for TTS and OCR. A selected, answering pycore runs the job
 * directly; otherwise Laravel queues a pycore task (or answers `pycore_unavailable`); with both away the job
 * waits in the durable journal and resumes by itself.
 */
import { pycoreApi } from '../../../../core/integrations/pycore';
import {
  COMPUTE_ERROR_CODES,
  createChannelAvailability,
  createComputeScheduler,
  type AvailabilitySource,
  type ComputeAttempt,
  type ComputeJob,
  type ComputeKind,
  ComputeJobError,
} from '../../../../core/integrations/compute';
import {
  classifyLaravelCompute,
  classifyLaravelTaskStatus,
  type LaravelTaskRef,
} from '../../../../core/integrations/laravel/LaravelCompute';
import { clientKeyFailureMessage } from '../../../../core/integrations/laravel/ClientKeyFailure';
import { CLIENT_KEY_ERROR_CODES } from '../../../../core/contracts/ServiceContract';
import { IDEMPOTENCY_KEY_HEADER } from '../../../../core/integrations/laravel/transport/BaseAPI';
import { wfNewAdminApi } from '../../api/WfNewAdminApi';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';

export const WORDNEW_COMPUTE_KINDS = { tts: 'tts', ocr: 'ocr' } as const;

export interface WordNewTtsPayload {
  text: string;
  language: string;
}

export interface WordNewTtsResult {
  url: string;
}

export interface WordNewOcrPayload {
  image_data: string;
  lang?: string;
  model_type?: string;
  languages?: string[];
  engine?: string;
}

export interface WordNewOcrResult {
  text: string;
  engine: string | null;
}

const MIME_DEFAULT = 'audio/mpeg';

const laravelSource: AvailabilitySource = {
  isUp: () => wfNewEndpoints.hasHealthyEndpoint() && !wfNewEndpoints.link.isReconnecting(),
  subscribe: (listener) => {
    const offEndpoints = wfNewEndpoints.subscribe(listener);
    const offLink = wfNewEndpoints.link.subscribe(listener);
    return () => {
      offEndpoints();
      offLink();
    };
  },
};

function base64Blob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

/** Request-level pycore codes that a retry cannot fix. */
const PYCORE_FINAL_CODES: ReadonlySet<string> = new Set(['model_input_required', 'model_input_invalid', 'model_unknown_engine']);

/** Failure of a pycore answer: its stable code and params; the other codes may succeed later or on Laravel. */
function pycoreFailure(answer: { error_code?: string | null; error_params?: Record<string, unknown> } | null): ComputeAttempt<never> {
  const code = answer?.error_code || COMPUTE_ERROR_CODES.requestFailed;
  return { status: 'failed', failure: { code, params: answer?.error_params, retryable: !PYCORE_FINAL_CODES.has(code) } };
}

/** Failure codes with a wordnew message (`compute.error.<code>`); any other code shows the generic one. */
const ERROR_TEXT_CODES: ReadonlySet<string> = new Set([
  COMPUTE_ERROR_CODES.cancelled, COMPUTE_ERROR_CODES.requestFailed, COMPUTE_ERROR_CODES.maxAttempts,
  'LARAVEL_TASK_FAILED', 'pycore_unavailable', 'AI_PAID_MODEL_REFUSED', 'AI_FREE_IMAGE_MODEL_UNAVAILABLE',
  'model_input_required', 'model_input_invalid', 'model_no_engine_available', 'model_unknown_engine',
  'model_engine_failed', 'model_empty_output',
]);

type Translate = (key: string, replacements?: Record<string, string | number>) => string;

/** User text of a failed job: localized by code and params, never the raw backend text. */
export function wordNewComputeErrorText(trans: Translate, error: unknown): string | null {
  if (!(error instanceof ComputeJobError)) return null;
  if (CLIENT_KEY_ERROR_CODES.includes(error.code)) return clientKeyFailureMessage(error.code);
  const params = Object.fromEntries(Object.entries(error.params).map(([key, value]) => [key, String(value)]));
  return trans(ERROR_TEXT_CODES.has(error.code) ? `compute.error.${error.code}` : 'compute.error.generic', params);
}

/** A thrown Laravel error with an answer body is classified; one without (connection) is rethrown as a path drop. */
function laravelAttempt<R>(error: unknown, readResult: (data: any) => R | undefined): ComputeAttempt<R> {
  const body = (error as { body?: unknown } | null)?.body;
  if (!body) throw error;
  return classifyLaravelCompute(body, readResult);
}

const readTtsResult = (data: any): WordNewTtsResult | undefined => {
  const url = wfNewAdminApi.absUrl(data?.audio_url ?? null);
  return url ? { url } : undefined;
};

const ttsKind: ComputeKind<WordNewTtsPayload, WordNewTtsResult> = {
  kind: WORDNEW_COMPUTE_KINDS.tts,
  async pycore(job, { signal, progress }) {
    const answer = await pycoreApi.synthesizeSpeech({ text: job.payload.text, language: job.payload.language, client_task_id: job.id }, signal, progress);
    if (!answer?.success || !answer.audio_base64) return pycoreFailure(answer);
    const blob = base64Blob(answer.audio_base64, answer.mime || MIME_DEFAULT);
    return { status: 'done', result: { url: URL.createObjectURL(blob) } };
  },
  async laravel(job, { signal }) {
    const request = { ...job.payload, client_task_id: job.id };
    const extra = { headers: { [IDEMPOTENCY_KEY_HEADER]: job.id }, signal };
    try {
      return classifyLaravelCompute(await wfNewAdminApi.ttsGenerateEnvelope(request, extra), readTtsResult);
    } catch (error) {
      return laravelAttempt(error, readTtsResult);
    }
  },
  async pollLaravel(job, { signal, progress }) {
    const ref = job.laravelRef as LaravelTaskRef | undefined;
    if (!ref) return { status: 'failed', failure: { code: COMPUTE_ERROR_CODES.requestFailed, retryable: true } };
    return classifyLaravelTaskStatus(await wfNewAdminApi.taskStatusEnvelope(ref.poll, { signal }), (result) => readTtsResult(result), progress);
  },
};

const readOcrResult = (data: any): WordNewOcrResult | undefined => {
  const source = typeof data?.text === 'string' ? data : data?.result;
  return typeof source?.text === 'string' ? { text: source.text, engine: source.engine ?? null } : undefined;
};

const ocrKind: ComputeKind<WordNewOcrPayload, WordNewOcrResult> = {
  kind: WORDNEW_COMPUTE_KINDS.ocr,
  async pycore(job, { signal, progress }) {
    const answer = await pycoreApi.recognizeOcr({ ...job.payload, client_task_id: job.id }, signal, progress);
    if (!answer?.success) return pycoreFailure(answer);
    return { status: 'done', result: { text: answer.text, engine: answer.engine } };
  },
  async laravel(job, { signal }) {
    const request = { ...job.payload, client_task_id: job.id };
    const extra = { headers: { [IDEMPOTENCY_KEY_HEADER]: job.id }, signal };
    try {
      return classifyLaravelCompute(await wfNewAdminApi.ocrRecognizeEnvelope(request, extra), readOcrResult);
    } catch (error) {
      return laravelAttempt(error, readOcrResult);
    }
  },
  async pollLaravel(job, { signal, progress }) {
    const ref = job.laravelRef as LaravelTaskRef | undefined;
    if (!ref) return { status: 'failed', failure: { code: COMPUTE_ERROR_CODES.requestFailed, retryable: true } };
    return classifyLaravelTaskStatus(await wfNewAdminApi.taskStatusEnvelope(ref.poll, { signal }), readOcrResult, progress);
  },
};

export const wordNewCompute = createComputeScheduler({
  journalName: 'wordnew_compute',
  laravel: laravelSource,
  pycoreGate: () => wordNewPycoreLink.getSnapshot().selectedUrl !== '',
});
/** The one availability of pycore direct, pycore through the relay and Laravel, for every wordnew router. */
export const wordNewChannels = createChannelAvailability(wordNewCompute.getAvailability());

wordNewCompute.register(ttsKind);
wordNewCompute.register(ocrKind);
void wordNewCompute.start();

export function requestWordNewTts(payload: WordNewTtsPayload) {
  return wordNewCompute.submit<WordNewTtsPayload, WordNewTtsResult>(WORDNEW_COMPUTE_KINDS.tts, payload);
}

export function requestWordNewOcr(payload: WordNewOcrPayload) {
  return wordNewCompute.submit<WordNewOcrPayload, WordNewOcrResult>(WORDNEW_COMPUTE_KINDS.ocr, payload);
}

export type { ComputeJob };
