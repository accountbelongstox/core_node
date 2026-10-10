import { registerLocalDataGroups } from '../../../core/persistence/LocalDataRegistry';

/** WordNew-owned persistence registry. Key values preserve installed data. */
const PREFIX = 'nexus_' as const;

export const WordNewStorageKeys = {
  WORDNEW_SETTINGS: `${PREFIX}wordnew_settings`,
  WORDNEW_CLIENT_ID: `${PREFIX}wordnew_client_id`,
  WORDNEW_FINGERPRINT_VISITOR: 'wordnew_client_fp_visitor',
  WORDNEW_API_QUEUE: 'wordnew_api_queue',
  WORDNEW_READING_PROGRESS: 'wordnew_reading_progress',
  WORDNEW_READING_TODAY: 'wordnew_reading_today',
  WORDNEW_STUDY_PROGRESS: 'wfnew_study_progress_v1',
  WORDNEW_SENTENCE_WORD_CLIENT_KEY: 'wfnew.sentenceWords.clientKey',
  WORDNEW_ADMIN_LANGUAGE: 'wfnew_admin_lang',
  WORDNEW_ADMIN_TAB: 'wfnew_admin_tab',
  WORDNEW_DAILY_READING_PLAYER: 'wfnew.dailyReading.player',
  WORDNEW_DAILY_READING_SCROLL_OFFSETS: 'wfnew.dailyReading.scrollOffsets',
  WORDNEW_DAILY_READING_WORD_GROUP: 'wfnew.dailyReading.wordGroup',
  WORDNEW_DAILY_READING_GUEST_READS: 'wfnew.dailyReading.guestReads',
  WORDNEW_ORCH_AUDIO_PLAYER: 'wfnew.orchAudio.player',
  WORDNEW_ORCH_CLIP_ROOT: 'wfnew.orch.clipRoot',
  /** Content-update check of held clips: the index position the next slice starts at, and when the last run ended. */
  WORDNEW_CLIP_UPDATE_CURSOR: 'wfnew.orch.clipUpdate.cursor',
  WORDNEW_CLIP_UPDATE_CHECKED_AT: 'wfnew.orch.clipUpdate.checkedAt',
  /** In-app APK update (contract app_downloads.auto_update): when the last check ended, and the versionCode the user postponed. */
  WORDNEW_APP_UPDATE_CHECKED_AT: 'wfnew.appUpdate.checkedAt',
  WORDNEW_APP_UPDATE_DISMISSED_CODE: 'wfnew.appUpdate.dismissedCode',
  /** This device's orchestration id: random, generated once, never derived from a fingerprint. */
  WORDNEW_ORCH_DEVICE_ID: 'wfnew.orch.deviceId',
  WORDNEW_CUSTOM_WORDS: 'wfnew_custom_words',
  WORDNEW_SUPER_TOAST: 'wfnew_super_toast',
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

export type WordNewStorageKey = (typeof WordNewStorageKeys)[keyof typeof WordNewStorageKeys];

/** Keys of the device KV store (SQLite in the app, IndexedDB on the web). */
export const WordNewDeviceKvKeys = {
  /** Names of every scoped content-cache collection ever written. */
  SCOPE_COLLECTION_INDEX: 'wfnew_scope_collection_index',
} as const;

const K = WordNewStorageKeys;

registerLocalDataGroups([
  {
    id: 'wordnew.content_cache',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_content_cache',
    descriptionKey: 'common.local_data.groups.wordnew_content_cache_desc',
    clearable: true,
    sources: [
      {
        kind: 'collections',
        resolve: async () => {
          const { deviceKvGet } = await import('../../../shared/persistence/DeviceKvCache');
          const names = await deviceKvGet<string[]>(WordNewDeviceKvKeys.SCOPE_COLLECTION_INDEX);
          return Array.isArray(names) ? names : [];
        },
      },
      { kind: 'deviceKv', keys: [WordNewDeviceKvKeys.SCOPE_COLLECTION_INDEX] },
    ],
    clear: async () => {
      const { clearAllContentCaches } = await import('../runtime-store/WfNewContentCache');
      await clearAllContentCaches();
    },
  },
  {
    id: 'wordnew.learning_data',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_learning_data',
    descriptionKey: 'common.local_data.groups.wordnew_learning_data_desc',
    clearable: false,
    sources: [{
      kind: 'localStorage',
      keys: [
        K.WORDNEW_SETTINGS,
        K.WORDNEW_CUSTOM_WORDS,
        K.WORDNEW_READING_PROGRESS,
        K.WORDNEW_READING_TODAY,
        K.WORDNEW_STUDY_PROGRESS,
        K.WORDNEW_DAILY_READING_GUEST_READS,
      ],
    }],
  },
  {
    id: 'wordnew.pending_sync',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_pending_sync',
    descriptionKey: 'common.local_data.groups.wordnew_pending_sync_desc',
    clearable: false,
    sources: [{ kind: 'localStorage', keys: [K.WORDNEW_API_QUEUE] }],
  },
  {
    id: 'wordnew.device_identity',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_device_identity',
    descriptionKey: 'common.local_data.groups.wordnew_device_identity_desc',
    clearable: false,
    sources: [{
      kind: 'localStorage',
      keys: [
        K.WORDNEW_CLIENT_ID,
        K.WORDNEW_FINGERPRINT_VISITOR,
        K.WORDNEW_SENTENCE_WORD_CLIENT_KEY,
        K.WORDNEW_ORCH_DEVICE_ID,
        K.WORDNEW_ORCH_CLIP_ROOT,
        K.WORDNEW_MOCK_AUTH_USERS,
      ],
    }],
  },
  {
    id: 'wordnew.preferences',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_preferences',
    descriptionKey: 'common.local_data.groups.wordnew_preferences_desc',
    clearable: true,
    sources: [{
      kind: 'localStorage',
      keys: [
        K.WORDNEW_ADMIN_LANGUAGE,
        K.WORDNEW_ADMIN_TAB,
        K.WORDNEW_DAILY_READING_PLAYER,
        K.WORDNEW_DAILY_READING_SCROLL_OFFSETS,
        K.WORDNEW_DAILY_READING_WORD_GROUP,
        K.WORDNEW_ORCH_AUDIO_PLAYER,
        K.WORDNEW_CLIP_UPDATE_CURSOR,
        K.WORDNEW_CLIP_UPDATE_CHECKED_AT,
        K.WORDNEW_APP_UPDATE_CHECKED_AT,
        K.WORDNEW_APP_UPDATE_DISMISSED_CODE,
        K.WORDNEW_SUPER_TOAST,
      ],
    }],
  },
  {
    id: 'wordnew.mock_data',
    appId: 'wordnew',
    labelKey: 'common.local_data.groups.wordnew_mock_data',
    descriptionKey: 'common.local_data.groups.wordnew_mock_data_desc',
    clearable: true,
    sources: [{
      kind: 'localStorage',
      keys: [
        K.WORDNEW_MOCK_PREFERENCES,
        K.WORDNEW_MOCK_DEVICE_SETTINGS,
        K.WORDNEW_MOCK_LANGUAGES,
        K.WORDNEW_MOCK_FRIENDS,
        K.WORDNEW_MOCK_CONVERSATIONS,
        K.WORDNEW_MOCK_MESSAGES,
        K.WORDNEW_MOCK_REQUESTS,
        K.WORDNEW_MOCK_NOTIFICATIONS,
        K.WORDNEW_MOCK_POSTS,
        K.WORDNEW_MOCK_COMMENTS,
        K.WORDNEW_MOCK_LIVE,
        K.WORDNEW_MOCK_LIVE_CHAT,
      ],
    }],
  },
]);
