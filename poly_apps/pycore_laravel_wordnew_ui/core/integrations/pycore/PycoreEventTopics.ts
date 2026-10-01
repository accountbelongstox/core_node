/** Central registry for Pycore domain event topics. */
import type { RelayEventName } from '../../contracts/RelayContract';

export { PYCORE_BROWSER_EVENTS } from './PycoreNetwork';

export const PYCORE_EVENT_TOPICS = {
  agentHistorySessionsChanged: 'agent_history.sessions.changed',
  agentHistoryPromptNew: 'agent_history.prompt.new',
  agentHistoryPromptDerived: 'agent_history.prompt.derived',
  agentHistoryPromptRewritten: 'agent_history.prompt.rewritten',
  agentHistoryVideoChanged: 'agent_history.video.changed',
  aiHubBootChanged: 'ai_hub.boot.changed',
  aiHubHistoryChanged: 'ai_hub.history.changed',
  aiUsageChanged: 'ai_usage.changed',
  modelLiveChanged: 'model_live.changed',
  agentHistoryConfigChanged: 'agent_history.config.changed',
  articlePublished: 'article.published',
  audioOrchestrationTasksChanged: 'audio_orchestration.tasks.changed',
  codeSyncLog: 'code_sync_log',
  codeSyncUpdate: 'code_sync_update',
  corebookAutoflow: 'corebook_autoflow',
  engineLoadStatusUpdate: 'engine_load_status_update',
  engineLoadLogAppended: 'engine_load_log_appended',
  i18nLanguageChanged: 'ui.i18n.language_changed',
  laravelEndpointChanged: 'laravel_endpoint_changed',
  laravelHttp: 'laravel_http',
  operationChanged: 'operation.changed',
  pycoreLog: 'pycore_log',
  queueBump: 'queue_bump',
  queueCenterSnapshotChanged: 'queue_center.snapshot.changed',
  queueCenterAudioLaneChanged: 'queue_center.audio_lane.changed',
  qwenJobCompleted: 'tts.qwen3tts.job.completed',
  qwenJobFailed: 'tts.qwen3tts.job.failed',
  qwenQueueChanged: 'tts.qwen3tts.queue.changed',
  qwenQueueEvent: 'tts.qwen3tts.queue.event',
  systemSettingsUpdate: 'system_settings_update',
  terminalChanged: 'terminal.changed',
  subtitleLanguageFill: 'subtitle_language_fill',
  videoExtractSync: 'video_extract_sync',
  voiceSubtitleQueueUpdate: 'voice_subtitle_queue_update',
  voiceSubtitleUiHide: 'voice_subtitle_ui_hide',
  voiceSubtitleUiShow: 'voice_subtitle_ui_show',
  voiceSubtitleUpdate: 'voice_subtitle_update',
} as const;

export type PycoreEventTopic = typeof PYCORE_EVENT_TOPICS[keyof typeof PYCORE_EVENT_TOPICS];

/**
 * Relay device events pycore posts outside the batched pycore_events tunnel,
 * and the bus topic each one replays on (the relay tunnel bridges them once
 * for every consumer).
 */
export const PYCORE_RELAY_DEDICATED_TOPICS: Partial<Record<RelayEventName, PycoreEventTopic>> = {
  agent_history_prompt_new: PYCORE_EVENT_TOPICS.agentHistoryPromptNew,
  agent_history_prompt_derived: PYCORE_EVENT_TOPICS.agentHistoryPromptDerived,
  agent_history_config_changed: PYCORE_EVENT_TOPICS.agentHistoryConfigChanged,
  terminal_changed: PYCORE_EVENT_TOPICS.terminalChanged,
};
