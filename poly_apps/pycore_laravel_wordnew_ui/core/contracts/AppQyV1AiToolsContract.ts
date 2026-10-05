/**
 * AppQyV1 AI-tools route contract — the single declaration for the
 * translation/TTS endpoints shared by the laravel-manager AppQyV1 module, the
 * laravelApi ROUTES table, and the wordnew path registry.
 *
 * Values are route suffixes relative to the AppQyV1 base (`/api/app_qy_v1`),
 * verified against the backend routers (routes/AppQyV1Router/*.php).
 */
import queueCenterContract from '../../../../config/queue_center_contract.json';

export const APPQYV1_API_BASE = '/api/app_qy_v1';

const routeSuffix = (endpoint: string): string => endpoint.slice(APPQYV1_API_BASE.length);

export const APPQYV1_AI_TOOLS_ROUTES = {
  translationTranslate: '/ai_tools/translation/translate',
  translationLanguages: '/ai_tools/translation/languages',
  translationQueueList: '/ai_tools/translation/queue/list',
  translationBatchAdd: '/ai_tools/translation/queue/batch/add',
  ttsGenerate: '/ai_tools/tts/generate',
  ttsQueueStats: '/ai_tools/tts/queue/stats',
  ttsSentenceAudio: '/ai_tools/tts/sentence/audio',
  ttsQueueItems: '/tts/queue/items',
  /** Phrase audio (contract endpoint `audio_phrase_audio`; `passive=1` is read-only). */
  ttsPhraseAudio: routeSuffix(queueCenterContract.endpoints.audio_phrase_audio),
  /** Phrase audio report (contract endpoint `audio_phrase_report`). */
  ttsPhraseReport: routeSuffix(queueCenterContract.endpoints.audio_phrase_report),
  /** Phrases of sentences (contract endpoint `phrases_by_sentences`). */
  phrasesBySentences: routeSuffix(queueCenterContract.endpoints.phrases_by_sentences),
} as const;

/** Sentences per `phrases_by_sentences` request (DESIGN_PHRASE_PIPELINE.md section 5). */
export const APPQYV1_PHRASES_BY_SENTENCES_MAX_IDS = 500;

/** Word media routes (file-first resolve; `passive=1` is read-only). */
export const APPQYV1_WORD_MEDIA_ROUTES = {
  wordAudio: (language: string, word: string): string =>
    `/word/${encodeURIComponent(language)}/${encodeURIComponent(word)}/audio`,
  wordMedia: (language: string, word: string): string =>
    `/word/${encodeURIComponent(language)}/${encodeURIComponent(word)}/media`,
} as const;

/** Vocabulary-library cover task routes (enqueue POST / status GET share one path). */
export const APPQYV1_LIBRARY_COVER_ROUTES = {
  tasks: '/vocabulary/libraries/cover/tasks',
} as const;

/** Upper bound of library ids accepted per cover-task request (queue_center_contract.json library_cover.max_ids). */
export const APPQYV1_LIBRARY_COVER_MAX_IDS: number = queueCenterContract.library_cover.max_ids;
