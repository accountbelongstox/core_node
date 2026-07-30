/**
 * OCR / TTS / STT / speech history / capabilities HTTP surface for pycoreApi.
 */
import type {
  OcrTestResponse, TtsTestResponse, SttTestResponse,
  AiChatMessage, AiChatResponse, AiImageResponse,
} from './pycoreTypes';
import { requestPycoreHttp, PYCORE_HTTP_ROUTES, rewritePycoreEndpoint } from './PycoreApiTransport';

/**
 * Engine tests cold-start isolated venvs and load multi-GB models (qwen3tts
 * health wait alone allows 180s server-side), so the default 30s HTTP deadline
 * is guaranteed to fire. Give live engine tests a 10-minute budget.
 */
const ENGINE_TEST_TIMEOUT_MS = 10 * 60_000;

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
  /** Open the clip's folder in the OS file manager (path resolved by id). */
  revealSpeech: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.speechHistoryHistoryReveal, { audio_id: id }),

  // --- OCR engine availability (windows -> easyocr -> cnocr priority) ------ #
  getOcrStatus: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.localOcrStatus, {}),

  // --- TTS live availability + version (edge-tts 403/region probe) --------- #
  getTtsStatus: (refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.localTtsStatus, { refresh: refresh ? 1 : 0 }),

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

  testLlmEngine: (req: { engine?: string }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.llmStatusTest, req),

  controlLlmServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.llmStatusPostServerAction, req),

  // --- TTS live per-engine synth test (actually runs the engine) ----------- #
  // Uses the HTTP controller gateway. Accepts per-engine extra params
  // (speaker, instruct, gender, voice, description, cfg_value, timesteps,
  // speaker_id, prompt_text, prompt_lang, speed) — ignored by engines that
  // don't use them.
  testTts: (req: Record<string, unknown>) => {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.localTtsTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<TtsTestResponse>;
  },

  // --- STT engine availability + live recognition test --------------------- #
  getSttStatus: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.localSttStatus, {}),
  testStt: (req: { engine?: string; language?: string; text?: string; model?: string }) => {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.localSttTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<SttTestResponse>;
  },

  // --- OCR live per-engine recognition test -------------------------------- #
  testOcr: (req: { engine?: string; image_data?: string; image_path?: string; lang?: string; model_type?: string; languages?: string[] }) => {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '' && v !== null) params[k] = v; }
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.localOcrTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<OcrTestResponse>;
  },

  // --- AI chat test (one turn through gateway or explicit provider) --------- #
  testAiChat: (req: { provider: string; messages?: AiChatMessage[]; message?: string; model?: string; source?: string }) => {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.localAiChat, params, ENGINE_TEST_TIMEOUT_MS) as Promise<AiChatResponse>;
  },

  // --- AI image test (one provider, inline base64 result) ------------------- #
  testAiImage: (req: { provider: string; prompt?: string; size?: string; model?: string }) => {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.localAiImageTest, params) as Promise<AiImageResponse>;
  },

  // --- Engine model-load progress (class-B models + class-C servers) ------- #
  // Live per-engine load state (idle|loading|loaded|error) + elapsed + a tail of
  // the startup/load log, for TTS and STT alike. The authoritative snapshot; the
  // SSE 'engine_load_status_update' events push per-engine deltas between polls.
  getEnginesLoadStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.enginesLoadStatusLoadStatus, {}),

  // --- Capabilities: CUDA/compute + free-library availability -------------- #
  getCapabilities: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusStatus, {}),

  // --- Code version: pycore's own + the pointed-to laravel backend's -------- #
  // UI -> pycore -> laravel: pycore reports its own newest-source mtime AND
  // proxies the Laravel /api/dashboard/code-last-modified probe through HTTP.
  // getJSON (the /api/local/ bridge). TTL-cached backend-side.
  getVersion: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.versionVersion, {}),

  // --- System info: read-only constants + static dirs (one-click open) ----- #
  getSystemInfo: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusInfo, {}),
  openStaticDir: (key: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusOpenDirectory, { key }),

};
