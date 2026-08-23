import { delay } from '../WfNewApiMockHelpers';

export const mockLearningMethods = {
  async getBookReadingProgress(_sourceKey: string) {
    return delay(null);
  },

  async saveBookReadingProgress(
    sourceKey: string,
    payload: { chapterIndex?: number | null; verseSeq: number; grain?: string; page?: number },
  ) {
    return delay({
      sourceKey,
      chapterIndex: payload.chapterIndex ?? null,
      verseSeq: payload.verseSeq,
      grain: payload.grain ?? 'sentence',
      page: payload.page ?? 1,
      updatedAt: new Date().toISOString(),
    });
  },

  async listBookReadingProgress(_limit = 100) {
    return delay([]);
  },

  async getDailyReadingProgress() {
    return delay(null);
  },

  async saveDailyReadingProgress(
    articleId: string | null,
    selectionMode: 'latest' | 'resume' | 'random' = 'latest',
  ) {
    return delay({
      articleId,
      selectionMode,
      updatedAt: new Date().toISOString(),
    });
  },

  async previewDailyReadingResources(
    articleId: string,
    settings: Parameters<import('../WfNewApiTypes').WfNewApi['previewDailyReadingResources']>[1],
    groupId: string | null = null,
    batchName = 'default',
  ) {
    const resource = {
      user: { id: 1, username: 'mock-user' },
      article: {
        id: articleId,
        title_en: 'Mock daily reading',
        title_cn: null,
        language: 'en',
        word_count: 0,
      },
      target_word_group: groupId ? {
        id: groupId,
        name: 'Mock Word Group',
        language: 'en',
        is_language_default: false,
      } : null,
      virtual_read_batch: {
        name: batchName,
        language: 'en',
        consumed: false,
        recorded_word_count: 0,
        read_word_count_before: 0,
        read_word_count_after: 0,
        read_event_count_before: 0,
        read_event_count_after: 0,
      },
      settings,
      resources: {
        new_words: [],
        selected_words: [],
        sentence_table: [],
        audio: {},
        playback_items: [],
      },
    };
    return delay({
      resource,
      apiUrl: '',
      expiresAt: '',
      batchName,
    });
  },

  async getClientDeviceSettings(clientKey: string) {
    const { readMockDeviceSettings } = await import('../WfNewApiMockHelpers');
    return delay(readMockDeviceSettings(clientKey));
  },

  async saveClientDeviceSettings(
    clientKey: string,
    reader: Parameters<import('../WfNewApiTypes').WfNewApi['saveClientDeviceSettings']>[1],
    updatedAt?: string,
  ) {
    const { writeMockDeviceSettings } = await import('../WfNewApiMockHelpers');
    const timestamp = updatedAt ?? new Date().toISOString();
    return delay(writeMockDeviceSettings(clientKey, reader, timestamp));
  },

  async addLibraryToDefaultGroup(libraryId: number | string) {
    return delay({
      gid: 'mock-default-group',
      library_id: Number(libraryId),
      library_name: 'Mock Library',
      already_linked: false,
      words_added: 0,
      total_words_in_library: 0,
    });
  },

  async previewAddLibraryToDefaultGroup(libraryId: number | string) {
    return delay({
      gid: 'mock-default-group',
      library_id: Number(libraryId),
      library_name: 'Mock Library',
      already_linked: false,
      current_in_group: 120,
      library_total: 500,
      to_add: 480,
      projected_total: 600,
      duplicates: [],
      duplicates_count: 20,
      language_match: true,
      status_breakdown: { read: 60, memorized: 25, due: 15, total: 120 },
    });
  },

  async getGroupProgressBlob(gid: string) {
    return delay({
      gid,
      gname: 'Mock Group',
      language_code: 'en',
      total_words: 0,
      legend: {},
      words: {},
    });
  },

  async updateGroupProgress(_payload: unknown) {
    return delay({ success: true });
  },

  async recitationLog(payload: { words: unknown[] }) {
    const date = new Date().toISOString().slice(0, 10);
    return delay({
      logged: payload.words.length,
      date,
      today: { unique_words: payload.words.length, actions: payload.words.length, goal: 20, goal_met: false },
    });
  },

  async recitationTodayPlan() {
    return delay({ date: new Date().toISOString().slice(0, 10), goal: 20, done_today: 0, words: [] });
  },

  async recitationSummary(date?: string) {
    return delay({ date: date ?? new Date().toISOString().slice(0, 10), unique_words: 0, actions: 0, goal: 20, goal_met: false, words: [] });
  },

  async recitationStreak() {
    return delay({ current_streak: 0, longest_streak: 0, days: [] });
  },
};
