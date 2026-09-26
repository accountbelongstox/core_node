/**
 * AppQyV1 AI-tools route contract — the single declaration for the
 * translation/TTS endpoints shared by the laravel-manager AppQyV1 module, the
 * laravelApi ROUTES table, and the wordnew path registry.
 *
 * Values are route suffixes relative to the AppQyV1 base (`/api/app_qy_v1`),
 * verified against the backend routers (routes/AppQyV1Router/*.php).
 */
export const APPQYV1_API_BASE = '/api/app_qy_v1';

export const APPQYV1_AI_TOOLS_ROUTES = {
  translationTranslate: '/ai_tools/translation/translate',
  translationLanguages: '/ai_tools/translation/languages',
  translationQueueList: '/ai_tools/translation/queue/list',
  translationBatchAdd: '/ai_tools/translation/queue/batch/add',
  ttsGenerate: '/ai_tools/tts/generate',
  ttsQueueStats: '/ai_tools/tts/queue/stats',
  ttsSentenceAudio: '/ai_tools/tts/sentence/audio',
  ttsQueueItems: '/tts/queue/items',
} as const;

/** Vocabulary-library cover task routes (enqueue POST / status GET share one path). */
export const APPQYV1_LIBRARY_COVER_ROUTES = {
  tasks: '/vocabulary/libraries/cover/tasks',
} as const;

/** Upper bound of library ids accepted per cover-task request. */
export const APPQYV1_LIBRARY_COVER_MAX_IDS = 200;
