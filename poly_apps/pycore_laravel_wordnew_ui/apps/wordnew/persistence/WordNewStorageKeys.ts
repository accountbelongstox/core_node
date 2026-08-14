/** WordNew-owned persistence registry. Key values preserve installed data. */
const PREFIX = 'nexus_' as const;

export const WordNewStorageKeys = {
  WORDNEW_SETTINGS: `${PREFIX}wordnew_settings`,
  WORDNEW_CLIENT_ID: `${PREFIX}wordnew_client_id`,
  WORDNEW_FINGERPRINT_VISITOR: 'wordnew_client_fp_visitor',
  WORDNEW_API_QUEUE: 'wordnew_api_queue',
  WORDNEW_READING_PROGRESS: 'wordnew_reading_progress',
  WORDNEW_STUDY_PROGRESS: 'wfnew_study_progress_v1',
  WORDNEW_SENTENCE_WORD_CLIENT_KEY: 'wfnew.sentenceWords.clientKey',
  WORDNEW_ADMIN_LANGUAGE: 'wfnew_admin_lang',
  WORDNEW_ADMIN_TAB: 'wfnew_admin_tab',
  WORDNEW_DAILY_READING_PLAYER: 'wfnew.dailyReading.player',
  WORDNEW_DAILY_READING_SCROLL_OFFSETS: 'wfnew.dailyReading.scrollOffsets',
  WORDNEW_DAILY_READING_WORD_GROUP: 'wfnew.dailyReading.wordGroup',
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
