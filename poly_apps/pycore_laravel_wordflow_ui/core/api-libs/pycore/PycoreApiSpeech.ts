/**
 * OCR / TTS / STT / speech history / capabilities RPC surface for pycoreApi.
 */
import type {
  OcrTestResponse, TtsTestResponse, SttTestResponse,
  AiChatMessage, AiChatResponse, AiImageResponse,
} from './pycoreTypes';
import { callRpc, isWsConnected, PYCORE_RPC_ROUTES, rewritePycoreEndpoint } from './PycoreApiTransport';

/**
 * Engine tests cold-start isolated venvs and load multi-GB models (qwen3tts
 * health wait alone allows 180s server-side), so the default 30s RPC deadline
 * is guaranteed to fire. Give live engine tests a 10-minute budget.
 */
const ENGINE_TEST_TIMEOUT_MS = 10 * 60_000;

export const pycoreApiSpeech = {
  // --- Speech (TTS/STT) clip history — audio side of the Records timeline --- #
  getSpeechHistory: (limit = 50) =>
    callRpc(PYCORE_RPC_ROUTES.speechHistory, { action: 'history', limit }),
  /** Raw-bytes URL for one clip (use directly in an <audio src>). */
  speechHistoryFileUrl: (id: string): string =>
    rewritePycoreEndpoint(`/api/local/speech/history/file/${encodeURIComponent(id)}`),
  deleteSpeechHistory: (id: string) =>
    callRpc(PYCORE_RPC_ROUTES.speechHistory, { action: 'delete', id }),
  clearSpeechHistory: () =>
    callRpc(PYCORE_RPC_ROUTES.speechHistory, { action: 'clear' }),
  /** Open the clip's folder in the OS file manager (path resolved by id). */
  revealSpeech: (id: string) =>
    callRpc(PYCORE_RPC_ROUTES.speechHistory, { action: 'reveal', id }),

  // --- OCR engine availability (windows -> easyocr -> cnocr priority) ------ #
  getOcrStatus: () => callRpc(PYCORE_RPC_ROUTES.localOcrStatus, {}),

  // --- TTS live availability + version (edge-tts 403/region probe) --------- #
  getTtsStatus: (refresh = false) =>
    callRpc(PYCORE_RPC_ROUTES.localTtsStatus, { refresh: refresh ? 1 : 0 }),

  // --- TTS tuning: per-attempt synth timeout + edge failure cooldown ------- #
  getTtsSettings: () => callRpc(PYCORE_RPC_ROUTES.tts, { action: 'settings' }),
  setTtsSettings: (patch: {
    synth_timeout_s?: number;
    edge_cooldown_s?: number;
    server_auto_manage?: boolean;
    server_single_active?: boolean;
    server_idle_shutdown_s?: number;
    server_enabled?: Record<string, boolean>;
  }) =>
    callRpc(PYCORE_RPC_ROUTES.tts, { action: 'settings_update', patch }),

  postTtsServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    callRpc(PYCORE_RPC_ROUTES.tts, { action: 'server', ...req }),

  // --- Local LLM engines (article pipeline): status / test / server control -- #
  getLlmStatus: () => callRpc(PYCORE_RPC_ROUTES.llm, { action: 'status' }),

  testLlmEngine: (req: { engine?: string }) =>
    callRpc(PYCORE_RPC_ROUTES.llm, { action: 'test', ...req }),

  controlLlmServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    callRpc(PYCORE_RPC_ROUTES.llm, { action: 'server', ...req }),

  // --- TTS live per-engine synth test (actually runs the engine) ----------- #
  // Always over WS (no HTTP fallback). Accepts per-engine extra params
  // (speaker, instruct, gender, voice, description, cfg_value, timesteps,
  // speaker_id, prompt_text, prompt_lang, speed) — ignored by engines that
  // don't use them.
  testTts: (req: Record<string, unknown>) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc(PYCORE_RPC_ROUTES.localTtsTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<TtsTestResponse>;
  },

  // --- STT engine availability + live recognition test --------------------- #
  getSttStatus: () => callRpc(PYCORE_RPC_ROUTES.localSttStatus, {}),
  testStt: (req: { engine?: string; language?: string; text?: string; model?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc(PYCORE_RPC_ROUTES.localSttTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<SttTestResponse>;
  },

  // --- OCR live per-engine recognition test -------------------------------- #
  testOcr: (req: { engine?: string; image_data?: string; image_path?: string; lang?: string; model_type?: string; languages?: string[] }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '' && v !== null) params[k] = v; }
    return callRpc(PYCORE_RPC_ROUTES.localOcrTest, params, ENGINE_TEST_TIMEOUT_MS) as Promise<OcrTestResponse>;
  },

  // --- AI chat test (one turn through gateway or explicit provider) --------- #
  testAiChat: (req: { provider: string; messages?: AiChatMessage[]; message?: string; model?: string; source?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc(PYCORE_RPC_ROUTES.localAiChat, params, ENGINE_TEST_TIMEOUT_MS) as Promise<AiChatResponse>;
  },

  // --- AI image test (one provider, inline base64 result) ------------------- #
  testAiImage: (req: { provider: string; prompt?: string; size?: string; model?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc(PYCORE_RPC_ROUTES.localAiImageTest, params) as Promise<AiImageResponse>;
  },

  // --- Engine model-load progress (class-B models + class-C servers) ------- #
  // Live per-engine load state (idle|loading|loaded|error) + elapsed + a tail of
  // the startup/load log, for TTS and STT alike. The authoritative snapshot; the
  // rpc_v2 'engine_load_status_update' WS event pushes per-engine deltas between polls.
  getEnginesLoadStatus: () =>
    callRpc(PYCORE_RPC_ROUTES.runtime, { action: 'engine_load_status' }),

  // --- Capabilities: CUDA/compute + free-library availability -------------- #
  getCapabilities: () => callRpc(PYCORE_RPC_ROUTES.runtime, { action: 'capabilities' }),

  // --- Code version: pycore's own + the pointed-to laravel backend's -------- #
  // UI -> pycore -> laravel: pycore reports its own newest-source mtime AND
  // proxies the laravel /api/dashboard/code-last-modified probe. Inherits WS via
  // getJSON (the /api/local/ bridge). TTL-cached backend-side.
  getVersion: () => callRpc(PYCORE_RPC_ROUTES.version, {}),

  // --- System info: read-only constants + static dirs (one-click open) ----- #
  getSystemInfo: () => callRpc(PYCORE_RPC_ROUTES.runtime, { action: 'info' }),
  openStaticDir: (key: string) =>
    callRpc(PYCORE_RPC_ROUTES.runtime, { action: 'open_dir', key }),

};
