/** Pycore Manager-owned runtime cache keys. */
export const PycoreManagerCacheStorageKeys = {
  PYCORE_CACHE_QUEUE: 'pycore_queue_cache',
  PYCORE_CACHE_QUEUE_TS: 'pycore_queue_cache_ts',
  PYCORE_UI_STATE_PENDING_REVISION: 'pc_ui_state_pending_revision',
} as const;

/** Pycore Manager-owned UI persistence registry. */
export const PycoreManagerUiStorageKeys = {
  PYCORE_CACHE_SETTINGS: 'pycore_settings',
  PYCORE_CACHE_THEME_LEGACY: 'pycore_theme',
  PYCORE_SENTENCE_WORKER_CONCURRENCY: 'pc_sentence_worker_concurrency',
  PYCORE_SENTENCE_QWEN_SPEAKER: 'pc_sentence_qwen_speaker',
  PYCORE_VIDEO_EXTRACT_AUTO_SYNC: 'pycore.video-extract.autoSync',
  PYCORE_HTTP_DEBUG_OPEN: 'pc_http_debug_open',
  PYCORE_LOG_OPEN: 'pc_log_open',
  PYCORE_QUEUE_CENTER_AUTO: 'pc_qc_auto',
  PYCORE_QUEUE_CENTER_DRAWER: 'pc_qc_drawer',
  PYCORE_SENTENCE_AUDIO_GENERATION: 'pc_sentence_audio_gen',
  PYCORE_WORD_AUDIO_EXPANDED: 'pc_word_audio_expanded',
  PYCORE_WORD_AUDIO_ENGINE: 'pc_word_audio_engine',
  PYCORE_WORD_TTS_CONCURRENCY: 'pc_word_tts_concurrency',
  PYCORE_CODE_SYNC_TREE_OPEN: 'pc.codesync.tree.open',
  PYCORE_CODE_SYNC_TREE_EXPANDED: 'pc.codesync.tree.expanded',
  PYCORE_AI_TAB: 'pc_ai_tab',
  PYCORE_CONTENT_TAB: 'pc_content_tab',
  PYCORE_VOCAB_TAB: 'pc_vocab_tab',
  PYCORE_AGENT_HISTORY_UI: 'pc_agent_history_ui',
  PYCORE_AGENT_HISTORY_RECORD_PAGE: 'pc_agent_history_record_page',
} as const;

export const PycoreManagerStorageKeys = {
  ...PycoreManagerCacheStorageKeys,
  ...PycoreManagerUiStorageKeys,
} as const;

export const PYCORE_MANAGER_SYNCED_STORAGE_KEYS = Object.freeze(
  Array.from(new Set(Object.values(PycoreManagerUiStorageKeys))),
);
