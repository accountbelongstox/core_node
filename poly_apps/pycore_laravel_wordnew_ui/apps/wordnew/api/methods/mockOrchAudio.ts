import type { WfNewOrchAudioDetail, WfNewOrchAudioPage, WfNewOrchAudioSentencePage } from '../types/orchAudio';
import { ORCH_AUDIO_DEFAULT_PAGE_SIZE, ORCH_AUDIO_SENTENCE_PAGE_SIZE } from './orchAudio';

export const mockOrchAudioMethods = {
  async getOrchAudioPage(
    opts: { source?: string | null; page?: number; perPage?: number } = {},
  ): Promise<WfNewOrchAudioPage> {
    return {
      items: [],
      total: 0,
      page: opts.page ?? 1,
      perPage: opts.perPage ?? ORCH_AUDIO_DEFAULT_PAGE_SIZE,
      sources: [],
    };
  },

  async getOrchAudioDetail(_id: string): Promise<WfNewOrchAudioDetail | null> {
    return null;
  },

  async getOrchAudioSentencePage(_id: string, page: number): Promise<WfNewOrchAudioSentencePage> {
    return { items: [], page, perPage: ORCH_AUDIO_SENTENCE_PAGE_SIZE, total: 0 };
  },
};
