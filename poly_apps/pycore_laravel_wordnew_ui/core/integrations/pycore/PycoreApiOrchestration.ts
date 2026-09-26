/**
 * Audio-orchestration HTTP surface for pycoreApi.
 *
 * Mirrors the pycore `ui/audio_orch/*` routes (pyctl/audio_orchestration):
 * qy-app login, Laravel book list/sentence cache, orchestration task CRUD,
 * plan preview and background generation with progress polling.
 */
import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';
import { orchAccountSession } from './OrchAccountSession';
import type { QyWordGroup } from '../laravel/LaravelQyAccountAPI';
import type { AudioLaneKey, AudioLaneTrackCounts, AudioLaneTrackState } from '../../contracts/QueueCenterTypes';

export interface OrchBookItem {
  id?: number;
  source_key: string;
  title?: string;
  original_name?: string;
  language?: string;
  sentence_count?: number;
  image_url?: string | null;
}

/** One sync attempt (books list or one book's sentences); a new attempt replaces it. */
export interface OrchSyncState {
  status?: 'running' | 'done' | 'failed';
  fetched?: number;
  total?: number;
  /** Stable failure code (translated by the UI); `detail` is diagnostic only. */
  error_code?: string;
  detail?: string;
  /** Legacy raw error text from older pycore builds. */
  error?: string;
  attempt_at?: number;
  finished_at?: number;
  updated_at?: number;
}

export interface OrchBooksResponse {
  success: boolean;
  error?: string;
  cached?: boolean;
  fetched_at?: number;
  refreshing?: boolean;
  sync?: OrchSyncState;
  sync_states?: Record<string, OrchSyncState>;
  items: OrchBookItem[];
  cached_sentence_books?: string[];
}

export interface OrchSentenceRow {
  seq: number;
  chapter_index?: number | null;
  language: string;
  text: string;
  languages: Record<string, string>;
}

export interface OrchBookSentencesResponse {
  success: boolean;
  error?: string;
  cached?: boolean;
  syncing?: boolean;
  sync?: OrchSyncState;
  source_key?: string;
  title?: string;
  language?: string;
  fetched_at?: number;
  sentence_total?: number;
  truncated?: boolean;
  sentences?: OrchSentenceRow[];
}

export interface OrchAuthStatus {
  success: boolean;
  logged_in: boolean;
  error?: string;
  username?: string;
  user?: { id?: number; username?: string; native_language?: string };
  logged_at?: number;
  machine_synced?: boolean;
  sync_error?: string;
  word_groups?: QyWordGroup[];
  word_group_id?: string;
}

export type OrchPatternStepType = 'sentence_en' | 'sentence_zh' | 'words_new' | 'words_all' | 'words';
export interface OrchPatternStep { type: OrchPatternStepType; times: number }

export interface OrchTaskPayload {
  name?: string;
  book: { source_key: string; title?: string; language?: string; target_language?: string };
  segment_mode?: 'count' | 'minutes';
  segment_value?: number;
  pattern?: OrchPatternStep[];
  word_mode?: 'new_only' | 'all';
  new_only_max_read_count?: number;
}

export interface OrchSegment {
  index: number;
  start: number;
  end: number;
  sentence_count: number;
  est_seconds?: number;
  item_count?: number;
  word_count?: number;
  status?: string;
  output?: string | null;
  error?: string | null;
}

export interface OrchTaskSummary {
  task_id: string;
  name: string;
  slug: string;
  book?: { source_key: string; title?: string; language?: string; target_language?: string };
  segment_mode?: string;
  segment_value?: number;
  word_mode?: string;
  status?: string;
  running?: boolean;
  segments_done?: number;
  segments_total?: number;
  progress?: {
    message?: string; segment_index?: number; item_index?: number; item_total?: number;
    output_dir?: string; current_item?: string;
    phase?: 'sync' | 'manifest' | 'resources' | 'assemble' | 'done';
    resource_index?: number; resource_total?: number;
    cache_hits?: number; laravel_hits?: number; generated?: number; missing?: number;
    synced?: number;
    sync_pending?: number;
    /** Live Part1 fill counters of this task per lane queue (word / sentence). */
    lanes?: Partial<Record<AudioLaneKey, AudioLaneTrackCounts>>;
  };
  created_at?: number;
  updated_at?: number;
}

export interface OrchTask extends OrchTaskSummary {
  pattern?: OrchPatternStep[];
  new_only_max_read_count?: number;
  virtual_read?: string[];
  segments?: OrchSegment[];
  events?: Array<{ ts: number; message: string }>;
}

export interface OrchSystemStatus {
  success: boolean;
  error?: string;
  probed_at?: number;
  ffmpeg?: { available: boolean; path?: string; version?: string; probe_error?: string };
  data_dir?: string;
  output_root?: string;
  tasks_total?: number;
  books_cached?: number;
  sentence_books_cached?: number;
  logged_in?: boolean;
}

export interface OrchTaskFile {
  name: string;
  bytes: number;
  modified_at: number;
}

export type OrchManifestCategory = 'all' | 'cache' | 'laravel' | 'generated' | 'synced' | 'missing' | 'pending';

export interface OrchManifestItem {
  resource_id: string;
  kind: string;
  language: string;
  text: string;
  status: 'ready' | 'missing' | 'pending';
  source: string;
  provider: string;
  synced: boolean;
  sync_queued: boolean;
  has_audio: boolean;
  /** Fill state of this resource in ITS lane queue (tracker of this task). */
  queue_lane?: AudioLaneKey;
  queue_state?: AudioLaneTrackState;
  queue_settled_by?: string;
}

export interface OrchManifestPageResponse {
  success: boolean;
  error?: string;
  items: OrchManifestItem[];
  total: number;
  page: number;
  page_count: number;
  category: OrchManifestCategory;
  running?: boolean;
  progress?: Record<string, unknown>;
}

export const pycoreApiOrchestration = {
  // --- qy-app login (persisted on the pycore side, loaded at startup) ------ #
  orchAuthLogin: (username: string, password: string) =>
    orchAccountSession.login(username, password),
  orchAuthStatus: () =>
    orchAccountSession.status(),
  orchAuthLogout: () =>
    orchAccountSession.logout(),
  orchAuthSync: (force = false) => orchAccountSession.sync(force),
  // Word groups are served by the pycore side, which owns the qy session
  // (auth.json) — the browser may hold no account at all.
  orchWordGroups: (refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchAuthGroups, { refresh }, 90_000) as Promise<OrchAuthStatus>,
  orchSelectWordGroup: (groupId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchAuthSelectGroup, { group_id: groupId }, 30_000) as Promise<OrchAuthStatus>,

  // --- Laravel books (cached on the pycore side) ---------------------------- #
  orchBooksList: (refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchBooksList, { refresh }, 120_000) as Promise<OrchBooksResponse>,
  orchBookSentences: (sourceKey: string, refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchBookSentences, { source_key: sourceKey, refresh }, 180_000) as Promise<OrchBookSentencesResponse>,

  // --- orchestration tasks -------------------------------------------------- #
  orchTasksList: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTasksList, {}) as Promise<{ success: boolean; tasks: OrchTaskSummary[] }>,
  orchTaskGet: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskGet, { task_id: taskId }) as Promise<OrchTask & { success: boolean; error?: string }>,
  orchTaskCreate: (payload: OrchTaskPayload) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskCreate, payload) as Promise<{ success: boolean; error?: string; task?: OrchTask }>,
  orchTaskUpdate: (taskId: string, patch: Partial<OrchTaskPayload>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskUpdate, { task_id: taskId, ...patch }) as Promise<{ success: boolean; error?: string; task?: OrchTask }>,
  orchTaskDelete: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskDelete, { task_id: taskId }) as Promise<{ success: boolean; error?: string }>,
  orchTaskPlan: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskPlan, { task_id: taskId }, 180_000) as Promise<{ success: boolean; error?: string; segments?: OrchSegment[]; sentence_total?: number }>,
  orchTaskGenerate: async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    await orchAccountSession.requireSynced();
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskGenerate, { task_id: taskId, ...orchAccountSession.generationAccount() });
  },
  orchTaskCancel: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskCancel, { task_id: taskId }) as Promise<{ success: boolean; error?: string }>,
  orchTaskProgress: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskProgress, { task_id: taskId }) as Promise<{
      success: boolean; error?: string; status?: string; running?: boolean;
      progress?: Record<string, unknown>; segments?: OrchSegment[];
      events?: Array<{ ts: number; message: string }>;
    }>,

  // --- pycore system status (cached ffmpeg probe) + generated files -------- #
  orchSystemStatus: (refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchSystemStatus, { refresh }) as Promise<OrchSystemStatus>,
  orchTaskFiles: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskFiles, { task_id: taskId }) as Promise<{
      success: boolean; error?: string; output_dir?: string; files: OrchTaskFile[];
    }>,
  orchTaskManifestPage: (taskId: string, category: OrchManifestCategory = 'all', page = 1, pageSize = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchTaskManifestPage, {
      task_id: taskId, category, page, page_size: pageSize,
    }) as Promise<OrchManifestPageResponse>,
  orchOpenOutput: (taskId?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchOpenOutput, taskId ? { task_id: taskId } : {}) as Promise<{ success: boolean; path?: string }>,
};
