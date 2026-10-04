/** Pycore Manager-owned runtime cache keys. */
export const PycoreManagerCacheStorageKeys = {
  PYCORE_CACHE_QUEUE: 'pycore_queue_cache',
  PYCORE_CACHE_QUEUE_TS: 'pycore_queue_cache_ts',
  PYCORE_UI_STATE_PENDING_REVISION: 'pc_ui_state_pending_revision',
  /** Prefix of the generic TTL cache entries (`<prefix><name>`). */
  PYCORE_TTL_CACHE_PREFIX: 'pycore_ttl_cache:',
  /** Task-registry key of the removed code-sync polling session (cleanup only). */
} as const;

/** Pycore Manager-owned UI persistence registry. */
export const PycoreManagerUiStorageKeys = {
  PYCORE_CACHE_SETTINGS: 'pycore_settings',
  PYCORE_SENTENCE_WORKER_CONCURRENCY: 'pc_sentence_worker_concurrency',
  PYCORE_SENTENCE_QWEN_SPEAKER: 'pc_sentence_qwen_speaker',
  PYCORE_VIDEO_EXTRACT_AUTO_SYNC: 'pycore.video-extract.autoSync',
  PYCORE_DEBUG_DOCK_OPEN: 'pc_debug_dock_open',
  PYCORE_DEBUG_DOCK_TAB: 'pc_debug_dock_tab',
  PYCORE_QUEUE_CENTER_AUTO: 'pc_qc_auto',
  PYCORE_QUEUE_CENTER_DRAWER: 'pc_qc_drawer',
  PYCORE_SENTENCE_AUDIO_GENERATION: 'pc_sentence_audio_gen',
  PYCORE_WORD_AUDIO_EXPANDED: 'pc_word_audio_expanded',
  PYCORE_CODE_SYNC_TREE_OPEN: 'pc.codesync.tree.open',
  PYCORE_CODE_SYNC_TREE_EXPANDED: 'pc.codesync.tree.expanded',
  PYCORE_AI_TAB: 'pc_ai_tab',
  PYCORE_AI_TOOL: 'pc_ai_tool',
  PYCORE_CONTENT_TAB: 'pc_content_tab',
  PYCORE_VOCAB_TAB: 'pc_vocab_tab',
  PYCORE_AGENT_HISTORY_UI: 'pc_agent_history_ui',
  PYCORE_AGENT_HISTORY_RECORD_PAGE: 'pc_agent_history_record_page',
  PYCORE_TERMINAL_SCHEDULES: 'pc.terminal.scheduleBackups.v3',
  PYCORE_TERMINAL_SCHEDULE_EDITOR: 'pc.terminal.scheduleEditor.v1',
  PYCORE_TERMINAL_DRAFT_CACHE: 'pc.terminal.draftCache.v1',
  PYCORE_TERMINAL_CAPTURE_OPEN_EDITOR: 'pc.terminal.captureOpenEditor.v1',
  PYCORE_TERMINAL_DISPATCH_ENABLED: 'pc.terminal.dispatchIdle.enabled.v1',
  PYCORE_TERMINAL_DISPATCH_AGENT: 'pc.terminal.dispatchIdle.agent.v1',
  PYCORE_MACHINE_SEND_SHORTCUT: 'pc.machineSend.shortcut',
  PYCORE_MACHINE_SEND_DOCK_OPEN: 'pc.machineSend.dockOpen',
  PYCORE_MACHINE_SEND_DOCK_TAB: 'pc.machineSend.dockTab',
  PYCORE_LOG_COPY_COUNT: 'pc.log.copyCount',
  PYCORE_LOG_ERRORS_ONLY: 'pc.log.errorsOnly',
  PYCORE_TERMINAL_RECENT_COMMAND: 'pc.terminal.recentCommand',
  PYCORE_TERMINAL_CHOICE_LABELS: 'pc.terminal.choiceLabels',
} as const;

/** Per-device UI session (last page, node, terminal, focus); never synced to the backend. */
export const PycoreManagerSessionStorageKeys = {
  PYCORE_UI_SESSION: 'pc.uiSession.v1',
  /** Per-node visit history of the terminal operation view (back / forward). */
  PYCORE_TERMINAL_NAV_PREFIX: 'pc.terminal.nav:',
  /** Terminal composer input mode on this device: text or voice. */
  PYCORE_TERMINAL_COMPOSER_MODE: 'pc.terminal.composerMode',
} as const;

export const PycoreManagerStorageKeys = {
  ...PycoreManagerCacheStorageKeys,
  ...PycoreManagerUiStorageKeys,
  ...PycoreManagerSessionStorageKeys,
} as const;

export const PYCORE_MANAGER_SYNCED_STORAGE_KEYS = Object.freeze(
  Array.from(new Set(Object.values(PycoreManagerUiStorageKeys))),
);
