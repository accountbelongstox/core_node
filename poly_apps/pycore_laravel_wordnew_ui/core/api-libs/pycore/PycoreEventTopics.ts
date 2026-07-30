/** Central registry for pycore HTTP event topics and browser-only events. */
export const PYCORE_EVENT_TOPICS = {
  agentHistorySessionsChanged: 'agent_history.sessions.changed',
  articlePublished: 'article.published',
  codeSyncUpdate: 'code_sync_update',
  corebookAutoflow: 'corebook_autoflow',
  engineLoadStatusUpdate: 'engine_load_status_update',
  i18nLanguageChanged: 'ui.i18n.language_changed',
  laravelEndpointChanged: 'laravel_endpoint_changed',
  laravelHttp: 'laravel_http',
  laravelLogsChanged: 'laravel.logs.changed',
  laravelLogsSnapshotUpdated: 'laravel.logs.snapshot.updated',
  operationChanged: 'operation.changed',
  pycoreLog: 'pycore_log',
  queueBump: 'queue_bump',
  qwenJobCompleted: 'tts.qwen3tts.job.completed',
  qwenJobFailed: 'tts.qwen3tts.job.failed',
  qwenQueueChanged: 'tts.qwen3tts.queue.changed',
  qwenQueueEvent: 'tts.qwen3tts.queue.event',
  systemSettingsUpdate: 'system_settings_update',
  subtitleLanguageFill: 'subtitle_language_fill',
  videoExtractSync: 'video_extract_sync',
  voiceSubtitleQueueUpdate: 'voice_subtitle_queue_update',
  voiceSubtitleUiHide: 'voice_subtitle_ui_hide',
  voiceSubtitleUiShow: 'voice_subtitle_ui_show',
  voiceSubtitleUpdate: 'voice_subtitle_update',
} as const;

export const PYCORE_BROWSER_EVENTS = {
  httpEventReplayLost: 'http_event_replay_lost',
  httpEventServerRestarted: 'http_event_server_restarted',
  laravelApiChanged: 'pycore:laravel-api-changed',
} as const;

export const VORTEX_PYCORE_EVENT_TOPICS = {
  marketProgress: 'okx_market_progress',
  marketStatus: 'okx_market_status',
  marketUpdate: 'okx_market_update',
} as const;

export type PycoreEventTopic = typeof PYCORE_EVENT_TOPICS[keyof typeof PYCORE_EVENT_TOPICS];
