/**
 * pycore API client. The Node server (server.ts) maps these to the real pycore
 * backend: /api/* (adapter) and /pyapi/* (transparent reverse proxy to :59000).
 * All paths are relative, so the UI works the same in PySide6 and a plain browser.
 */
import type {
  QueueItem, VideoExtractHistory, VideoExtractMode, VideoExtractOptions,
  VideoExtractCapabilities, PickPathResult, VideoExtractSegmentsResponse,
  SystemResourcesResponse, VideoExtractOpenKind, VideoExtractOpenResponse,
  CodeSyncRole, CodeSyncPeersResponse, CodeSyncCandidate,
  SyncSettings, SyncSettingsResponse, SyncLogEntry,
  AutostartStatus, AiProbeResponse, AiChatMessage, AiChatResponse,
  TranslationQueueResponse, TranslationQueueActionResponse,
} from '../types';

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return (await r.json()) as T;
}
async function postJSON<T>(url: string, body: unknown = {}): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await r.json()) as T;
}

export interface QueueResponse {
  success: boolean;
  items?: QueueItem[];
  currentIndex?: number;
  error?: string;
}

export interface RuntimeInfo { wsUrl: string; apiBase: string; }

export interface SystemSettingsResponse {
  success: boolean;
  settings: Record<string, unknown> | null;
  error?: string;
}

export const pycoreApi = {
  // --- queue (mapped from pycore /voice-subtitle/queue) ------------------- #
  getQueue: () => getJSON<QueueResponse>('/api/queue'),
  syncQueue: (items: QueueItem[]) => postJSON<{ success: boolean }>('/api/queue', { items }),
  clearQueue: () => postJSON<{ success: boolean }>('/api/queue', { items: [] }),

  // --- TTS (pycore voice-subtitle add-text pipeline) ---------------------- #
  tts: (text: string, langs: string[] = ['en'], category = 'normal') =>
    postJSON<{ success: boolean; queued?: boolean; task_id?: string; audio?: string; message?: string }>(
      '/api/tts', { text, langs, category }),

  // --- generic pycore passthrough (for new tabs: video-extract/code-sync/tasks)
  pyGet: <T = any>(path: string) => getJSON<T>('/pyapi' + path),
  pyPost: <T = any>(path: string, body: unknown = {}) => postJSON<T>('/pyapi' + path, body),

  ping: () => getJSON<{ success?: boolean; status?: string }>('/pyapi/ping'),

  // --- runtime (backend WS url + api base, from the Node server) ----------- #
  getRuntime: () => getJSON<RuntimeInfo>('/api/runtime'),

  // --- system settings (persisted on the pycore backend) ------------------ #
  getSystemSettings: () =>
    getJSON<SystemSettingsResponse>('/pyapi/api/local/user-data/system-settings'),
  setSystemSettings: (settings: Record<string, unknown>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/pyapi/api/local/user-data/system-settings', { settings }),

  // --- video extract history / options ------------------------------------ #
  getVideoExtractHistory: () =>
    getJSON<VideoExtractHistory>('/pyapi/api/local/user-data/video-extract'),
  addVideoExtractEntry: (path: string, mode: VideoExtractMode) =>
    postJSON<VideoExtractHistory>(
      '/pyapi/api/local/user-data/video-extract/add', { path, mode }),
  removeVideoExtractEntry: (path: string) =>
    postJSON<VideoExtractHistory>(
      '/pyapi/api/local/user-data/video-extract/remove', { path }),
  setVideoExtractOptions: (options: Partial<VideoExtractOptions>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/pyapi/api/local/user-data/video-extract/options', { options }),

  // --- video extract capabilities (installed models + languages + exts) --- #
  getVideoExtractCapabilities: () =>
    getJSON<VideoExtractCapabilities>('/pyapi/api/local/video-extract/capabilities'),

  // --- video extract: open a path in the OS file manager ------------------ #
  openVideoExtractPath: (kind: VideoExtractOpenKind, path?: string) =>
    postJSON<VideoExtractOpenResponse>(
      '/pyapi/api/local/video-extract/open', { kind, path }),

  // --- video extract: segment ↔ subtitle map for the current file --------- #
  // Pass `path = snapshot.current.segments_dir`. Returns the live mapping
  // (segments + their subtitles), which grows as the file is processed.
  getVideoExtractSegments: (path: string) =>
    postJSON<VideoExtractSegmentsResponse>(
      '/pyapi/api/local/video-extract/segments', { path }),

  // --- video extract: pause / resume a running task ----------------------- #
  pauseVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/pause`),
  resumeVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/resume`),
  cancelVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/cancel`),

  // --- live system resources (CPU / MEM / GPU) ---------------------------- #
  getSystemResources: () =>
    getJSON<SystemResourcesResponse>('/pyapi/api/local/system/resources'),

  // --- native OS folder/file picker (returns an absolute path) ------------ #
  pickPath: (mode: VideoExtractMode, initial?: string) =>
    postJSON<PickPathResult>(
      '/pyapi/api/local/user-data/pick-path', { mode, initial }),

  // --- code sync (peer mesh: dev/client roles + peer list) ---------------- #
  getPeers: () => getJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers'),
  addPeer: (peer: { name: string; host: string; port: number; role: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/add', peer),
  removePeer: (id: string) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/remove', { id }),
  updatePeer: (patch: { id: string; name?: string; host?: string; port?: number; role?: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/update', patch),
  setRole: (role: CodeSyncRole) =>
    postJSON<{ success: boolean; role: CodeSyncRole; error?: string }>(
      '/pyapi/code-sync/role', { role }),
  setDistribute: (enabled: boolean) =>
    postJSON<{ success: boolean; distributing: boolean; message?: string; error?: string }>(
      '/pyapi/code-sync/distribute', { enabled }),
  setSkipUpdate: (enabled: boolean) =>
    postJSON<{ success: boolean; skip_update: boolean; message?: string; error?: string }>(
      '/pyapi/code-sync/skip-update', { enabled }),
  discoverPeers: () =>
    postJSON<{ success: boolean; candidates: CodeSyncCandidate[]; error?: string }>(
      '/pyapi/code-sync/discover', {}),

  // --- code sync filter settings (presets + per-machine .data override) --- #
  getSyncSettings: () => getJSON<SyncSettingsResponse>('/pyapi/code-sync/settings'),
  setSyncSettings: (patch: Partial<SyncSettings>) =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/pyapi/code-sync/settings', patch),
  resetSyncSettings: () =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/pyapi/code-sync/settings/reset', {}),
  getSyncLogs: (limit = 100) =>
    getJSON<{ success: boolean; role: CodeSyncRole; logs: SyncLogEntry[] }>(
      `/pyapi/code-sync/logs?limit=${limit}`),

  // --- AI provider availability probe ------------------------------------- #
  // GET /api/local/ai/probe (via the /pyapi reverse proxy). `refresh` forces the
  // backend to re-probe live instead of serving its cached result.
  probeAi: (refresh = false) =>
    getJSON<AiProbeResponse>(`/pyapi/api/local/ai/probe${refresh ? '?refresh=1' : ''}`),

  // --- AI chat confirm: send a message to a provider, get its reply -------- #
  // POST /api/local/ai/chat (via the /pyapi reverse proxy).
  aiChat: (provider: string, messages: AiChatMessage[], model?: string) =>
    postJSON<AiChatResponse>('/pyapi/api/local/ai/chat', { provider, messages, model }),

  // --- translation queue (Laravel pending queue, steered via pycore) ------ #
  // GET /api/local/translation/queue (via the /pyapi reverse proxy). `refresh`
  // forces the backend to re-pull from Laravel instead of serving its cache.
  queueTranslation: (refresh = false) =>
    getJSON<TranslationQueueResponse>(
      `/pyapi/api/local/translation/queue${refresh ? '?refresh=1' : ''}`),
  // POST .../priority — raise/lower a queued task's priority, then refresh.
  setQueuePriority: (task_id: string, priority: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/pyapi/api/local/translation/queue/priority', { task_id, priority }),
  // POST .../stack — dedup+bump existing words or enqueue new ones at high
  // priority (the backend decides). `priority` is optional.
  stackQueue: (words: string[], language: string, target_language: string, priority?: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/pyapi/api/local/translation/queue/stack',
      { words, language, target_language, ...(priority != null ? { priority } : {}) }),

  // --- auto-start on boot (native OS startup entry) ----------------------- #
  getAutostart: () => getJSON<AutostartStatus>('/pyapi/api/manage/control/autostart'),
  setAutostart: (enabled: boolean) =>
    postJSON<AutostartStatus>('/pyapi/api/manage/control/autostart', { enabled }),
};

export type PycoreApi = typeof pycoreApi;
