import { registerLocalDataGroups } from '../../../core/persistence/LocalDataRegistry';
import { PROMPT_DERIVED_NEWEST_CACHE_KEY } from '../../../shared/prompt-derived/promptDerivedCacheKeys';

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

/** Keys of the device KV store (SQLite in the app, IndexedDB on the web). */
export const PycoreManagerDeviceKvKeys = {
  TERMINAL_DRAFTS: 'pc.terminal.drafts',
  PROMPT_DERIVED_NEWEST: PROMPT_DERIVED_NEWEST_CACHE_KEY,
} as const;

const TERMINAL_DRAFT_KEYS: readonly string[] = [PycoreManagerUiStorageKeys.PYCORE_TERMINAL_DRAFT_CACHE];
const AGENT_HISTORY_KEYS: readonly string[] = [
  PycoreManagerUiStorageKeys.PYCORE_AGENT_HISTORY_UI,
  PycoreManagerUiStorageKeys.PYCORE_AGENT_HISTORY_RECORD_PAGE,
];
const TERMINAL_TOOL_KEYS: readonly string[] = [
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULE_EDITOR,
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_CAPTURE_OPEN_EDITOR,
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_DISPATCH_ENABLED,
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_DISPATCH_AGENT,
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_RECENT_COMMAND,
  PycoreManagerUiStorageKeys.PYCORE_TERMINAL_CHOICE_LABELS,
];
const CACHE_KEYS: readonly string[] = [
  PycoreManagerUiStorageKeys.PYCORE_CACHE_SETTINGS,
  PycoreManagerCacheStorageKeys.PYCORE_CACHE_QUEUE,
  PycoreManagerCacheStorageKeys.PYCORE_CACHE_QUEUE_TS,
];
const SCHEDULE_KEYS: readonly string[] = [PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES];
const SYNC_STATE_KEYS: readonly string[] = [PycoreManagerCacheStorageKeys.PYCORE_UI_STATE_PENDING_REVISION];
const CLAIMED_KEYS = new Set<string>([
  ...TERMINAL_DRAFT_KEYS,
  ...AGENT_HISTORY_KEYS,
  ...TERMINAL_TOOL_KEYS,
  ...CACHE_KEYS,
  ...SCHEDULE_KEYS,
  ...SYNC_STATE_KEYS,
]);

registerLocalDataGroups([
  {
    id: 'pycore.terminal_drafts',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_terminal_drafts',
    descriptionKey: 'common.local_data.groups.pycore_terminal_drafts_desc',
    clearable: true,
    sources: [
      { kind: 'localStorage', keys: TERMINAL_DRAFT_KEYS },
      { kind: 'deviceKv', keys: [PycoreManagerDeviceKvKeys.TERMINAL_DRAFTS] },
    ],
  },
  {
    id: 'pycore.agent_history',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_agent_history',
    descriptionKey: 'common.local_data.groups.pycore_agent_history_desc',
    clearable: true,
    sources: [
      { kind: 'localStorage', keys: AGENT_HISTORY_KEYS },
      { kind: 'deviceKv', keys: [PycoreManagerDeviceKvKeys.PROMPT_DERIVED_NEWEST] },
    ],
  },
  {
    id: 'pycore.terminal_schedules',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_terminal_schedules',
    descriptionKey: 'common.local_data.groups.pycore_terminal_schedules_desc',
    clearable: false,
    sources: [{ kind: 'localStorage', prefixes: SCHEDULE_KEYS }],
  },
  {
    id: 'pycore.terminal_tools',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_terminal_tools',
    descriptionKey: 'common.local_data.groups.pycore_terminal_tools_desc',
    clearable: true,
    sources: [{ kind: 'localStorage', keys: TERMINAL_TOOL_KEYS }],
  },
  {
    id: 'pycore.cache',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_cache',
    descriptionKey: 'common.local_data.groups.pycore_cache_desc',
    clearable: true,
    sources: [{
      kind: 'localStorage',
      keys: CACHE_KEYS,
      prefixes: [PycoreManagerCacheStorageKeys.PYCORE_TTL_CACHE_PREFIX],
    }],
  },
  {
    id: 'pycore.sync_state',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_sync_state',
    descriptionKey: 'common.local_data.groups.pycore_sync_state_desc',
    clearable: false,
    sources: [{ kind: 'localStorage', keys: SYNC_STATE_KEYS }],
  },
  {
    id: 'pycore.ui_preferences',
    appId: 'pycore',
    labelKey: 'common.local_data.groups.pycore_ui_preferences',
    descriptionKey: 'common.local_data.groups.pycore_ui_preferences_desc',
    clearable: true,
    sources: [{
      kind: 'localStorage',
      keys: [
        ...Object.values(PycoreManagerUiStorageKeys).filter((key) => !CLAIMED_KEYS.has(key)),
        PycoreManagerSessionStorageKeys.PYCORE_UI_SESSION,
        PycoreManagerSessionStorageKeys.PYCORE_TERMINAL_COMPOSER_MODE,
      ],
      prefixes: [PycoreManagerSessionStorageKeys.PYCORE_TERMINAL_NAV_PREFIX],
    }],
  },
]);
