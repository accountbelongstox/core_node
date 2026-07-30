/**
 * Centralized local persistence keys.
 *
 * NOTE: This is code (not a data directory). We keep all keys here to avoid
 * scattered string literals across the app.
 */

const PREFIX = 'nexus_' as const;

export const StorageKeys = {
  // App / UI
  APP_STATE: `${PREFIX}app_state`,
  SETTINGS: `${PREFIX}settings`,
  LANGUAGE: `${PREFIX}language`,
  THEME: `${PREFIX}theme`,
  API_CURRENT_ENDPOINT: 'api_current_endpoint',
  API_AUTO_DETECTED_ENDPOINT: 'api_auto_detected',
  API_USER_MODIFIED_ENDPOINT: 'api_user_modified',
  API_RECHECK_INTERVAL_MS: 'api_recheck_interval_ms',
  API_CUSTOM_ENDPOINTS: 'api_custom_endpoints',
  SHELL_DARK: 'shell_dark',
  SHELL_LANGUAGE: 'shell_lang',
  SHELL_THEME_OVERRIDE: 'shell_theme_override',
  SHELL_DOCK_Y: 'shell_dock_y',
  SHELL_DOCK_Y_LEGACY: 'wf_shell_dock_y',

  // User
  USER: `${PREFIX}user`,

  // Server Manager (cache)
  SERVER_MANAGER_ACTIVE_TAB: `${PREFIX}servermanager_active_tab`,
  SERVER_MANAGER_NGINX_SITES: `${PREFIX}servermanager_nginx_sites`,
  SERVER_MANAGER_SSL_CERTS: `${PREFIX}servermanager_ssl_certs`,
  SERVER_MANAGER_FILE_CURRENT_PATH: `${PREFIX}servermanager_file_current_path`,
  SERVER_MANAGER_FILE_ALLOWED_PATHS: `${PREFIX}servermanager_file_allowed_paths`,
  SERVER_MANAGER_UNIFIED_APPS: `${PREFIX}servermanager_unified_apps`,
  SERVER_MANAGER_SCRIPTS: `${PREFIX}servermanager_scripts`,
  SERVER_MANAGER_CERTBOT_STATUS: `${PREFIX}servermanager_certbot_status`,

  // Pycore transport/cache + manager UI state.
  PYCORE_TARGET: 'pycore_target',
  PYCORE_TARGET_RECENT: 'pycore_target_recent',
  PYCORE_HTTP_BROWSER_ID: 'pycore_http_browser_id',
  PYCORE_HTTP_TAB_ID: 'pycore_http_tab_id',
  PYCORE_HEALTH_RECHECK_INTERVAL_MS: 'pc_health_recheck_interval_ms',
  PYCORE_CACHE_SETTINGS: 'pycore_settings',
  PYCORE_CACHE_QUEUE: 'pycore_queue_cache',
  PYCORE_CACHE_QUEUE_TS: 'pycore_queue_cache_ts',
  PYCORE_CACHE_THEME_LEGACY: 'pycore_theme',
  PYCORE_SENTENCE_WORKER_CONCURRENCY: 'pc_sentence_worker_concurrency',
  PYCORE_VIDEO_EXTRACT_AUTO_SYNC: 'pycore.video-extract.autoSync',
  PYCORE_LARAVEL_ENDPOINT: 'pycore_laravel_current_endpoint',
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
  PYCORE_VOICE_SUBTITLE_TAB: 'pc_vs_tab',
  PYCORE_VOICE_SUBTITLE_LANGUAGE: 'pc_vs_lang',
  PYCORE_VOCAB_TAB: 'pc_vocab_tab',

  // WordNew (/wordnew) app settings + profile (one consolidated WfNewSettings object).
  WORDNEW_SETTINGS: `${PREFIX}wordnew_settings`,
  /** Fallback guest client id when fingerprint + localStorage are unavailable. */
  WORDNEW_CLIENT_ID: `${PREFIX}wordnew_client_id`,
  WORDNEW_FINGERPRINT_VISITOR: 'wordnew_client_fp_visitor',
  WORDNEW_CLIENT_ID_CURRENT_LEGACY: 'wordnew_client_local_id',
  WORDNEW_CLIENT_ID_LEGACY: 'wf_client_local_id',
  WORDNEW_FINGERPRINT_VISITOR_LEGACY: 'wf_client_fp_visitor',
  // WordNew (/wordnew) social caches (partners / posts / chats).
  WORDNEW_SOCIAL: `${PREFIX}wordnew_social`,
  // WordNew (/wordnew) mock account registry (one object keyed by lowercased email).
  WORDNEW_ACCOUNTS: `${PREFIX}wordnew_accounts`,
  // WordNew (/wordnew) backend endpoint manager.
  // Consolidated store (current): one key holds the whole WfNewEndpointPrefs object.
  WORDNEW_API_PREFS: `${PREFIX}wordnew_api_prefs`,
  // Legacy split keys (pre-consolidation) — kept only so WfNewEndpointStore can
  // one-time migrate existing installs into WORDNEW_API_PREFS, then remove them.
  WORDNEW_API_CUSTOM_ENDPOINTS: `${PREFIX}wordnew_api_custom_endpoints`,
  WORDNEW_API_USER_ENDPOINT: `${PREFIX}wordnew_api_user_endpoint`,
  WORDNEW_API_AUTO_ENDPOINT: `${PREFIX}wordnew_api_auto_endpoint`,
  WORDNEW_API_CURRENT: `${PREFIX}wordnew_api_current`,
  WORDNEW_API_RECHECK_INTERVAL_MS: `${PREFIX}wordnew_api_recheck_interval_ms`,
  WORDNEW_API_QUEUE: 'wordnew_api_queue',
  WORDNEW_API_QUEUE_LEGACY: 'wf_api_queue',

  // WordNew runtime/session and page state. Values intentionally preserve the
  // existing keys so consolidation does not discard installed user data.
  WORDNEW_AUTH_TOKEN: 'wfnew_auth_token',
  WORDNEW_READING_PROGRESS: 'wordnew_reading_progress',
  WORDNEW_READER_DAILY: 'wfnew_reader_daily_v1',
  WORDNEW_STUDY_PROGRESS: 'wfnew_study_progress_v1',
  WORDNEW_SENTENCE_WORD_CLIENT_KEY: 'wfnew.sentenceWords.clientKey',
  WORDNEW_ADMIN_LANGUAGE: 'wfnew_admin_lang',
  WORDNEW_ADMIN_TAB: 'wfnew_admin_tab',
  WORDNEW_DAILY_READING_PLAYER: 'wfnew.dailyReading.player',
  WORDNEW_SUPER_TOAST: 'wfnew_super_toast',

  // WordNew offline/mock data.
  WORDNEW_MOCK_AUTH_USERS: 'wfnew_auth_mock_users',
  WORDNEW_MOCK_PREFERENCES: 'wfnew_prefs_mock',
  WORDNEW_MOCK_DEVICE_SETTINGS: 'wfnew_device_settings_mock',
  WORDNEW_MOCK_LANGUAGES: 'wfnew_langs_mock',
  WORDNEW_MOCK_FRIENDS: 'wfnew_friends_mock',
  WORDNEW_MOCK_CONVERSATIONS: 'wfnew_convos_mock',
  WORDNEW_MOCK_MESSAGES: 'wfnew_messages_mock',
  WORDNEW_MOCK_REQUESTS: 'wfnew_requests_mock',
  WORDNEW_MOCK_NOTIFICATIONS: 'wfnew_notifs_mock',
  WORDNEW_MOCK_POSTS: 'wfnew_posts_mock',
  WORDNEW_MOCK_COMMENTS: 'wfnew_comments_mock',
  WORDNEW_MOCK_LIVE: 'wfnew_live_mock',
  WORDNEW_MOCK_LIVE_CHAT: 'wfnew_live_chat_mock',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

