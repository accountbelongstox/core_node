/**
 * OCR / TTS / STT / speech history / capabilities HTTP surface for pycoreApi.
 */
import type {
  OcrTestResponse,
  OcrRecognizeResponse,
  TtsSynthesizeResponse,
  TtsTestResponse,
  SttTestResponse,
} from './PycoreSpeechTypes';
import type {
  AiChatMessage,
  AiChatResponse,
  AiImageResponse,
} from './PycoreAiTypes';
import { requestPycoreHttp, compactPycoreParams, ENGINE_TEST_TIMEOUT_MS, PYCORE_HTTP_ROUTES, rewritePycoreEndpoint } from './PycoreApiTransport';

export const pycoreApiSpeech = {
  // --- Speech (TTS/STT) clip history — audio side of the Records timeline --- #
  getSpeechHistory: (limit = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.speechHistoryHistory, { limit }),
  /** Raw-bytes URL for one clip (use directly in an <audio src>). */
  speechHistoryFileUrl: (id: string): string =>
    rewritePycoreEndpoint(`/api/local/speech/history/file/${encodeURIComponent(id)}`),
  deleteSpeechHistory: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.speechHistoryHistoryDelete, { audio_id: id }),
  clearSpeechHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.speechHistoryHistoryClear, {}),



  // --- TTS tuning: per-attempt synth timeout + edge failure cooldown ------- #
  getTtsSettings: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.ttsStatusGetSettings, {}),
  setTtsSettings: (patch: {
    synth_timeout_s?: number;
    edge_cooldown_s?: number;
    server_auto_manage?: boolean;
    server_single_active?: boolean;
    server_idle_shutdown_s?: number;
    server_enabled?: Record<string, boolean>;
  }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.ttsStatusPostSettings, patch),

  postTtsServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.ttsStatusPostServerAction, req),

  // --- Local LLM engines (article pipeline): status / test / server control -- #
  getLlmStatus: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.llmStatusStatus, {}),


  controlLlmServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.llmStatusPostServerAction, req),




  // --- Production compute (idempotent on client_task_id) ------------------ #
  synthesizeSpeech: (
    req: { text: string; language?: string; voice?: string; provider?: string; rate?: string | number; client_task_id: string },
    signal?: AbortSignal,
    onProgress?: (fraction: number) => void,
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.ttsSynthesize, compactPycoreParams(req), ENGINE_TEST_TIMEOUT_MS, signal, onProgress) as Promise<TtsSynthesizeResponse>,
  recognizeOcr: (
    req: { engine?: string; image_data?: string; image_path?: string; lang?: string; model_type?: string; languages?: string[]; client_task_id: string },
    signal?: AbortSignal,
    onProgress?: (fraction: number) => void,
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.localOcrRecognize, compactPycoreParams(req), ENGINE_TEST_TIMEOUT_MS, signal, onProgress) as Promise<OcrRecognizeResponse>,



  // --- Engine model-load progress (class-B models + class-C servers) ------- #
  // Live per-engine load state (idle|loading|loaded|error) + elapsed + a tail of
  // the startup/load log, for TTS and STT alike. The authoritative snapshot; the
  // SSE 'engine_load_status_update' events push per-engine deltas between polls.
  getEnginesLoadStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.enginesLoadStatusLoadStatus, {}),

  // --- Capabilities: CUDA/compute + free-library availability -------------- #
  getCapabilities: (refresh = false) => requestPycoreHttp(
    PYCORE_HTTP_ROUTES.capabilityStatusStatus,
    { refresh },
  ),

  // --- Code version: pycore local source tree ------------------------------ #
  getVersion: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.versionVersion, {}),

  // --- System info: read-only constants + static dirs (one-click open) ----- #
  getSystemInfo: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusInfo, {}),
  openStaticDir: (key: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusOpenDirectory, { key }),

};
