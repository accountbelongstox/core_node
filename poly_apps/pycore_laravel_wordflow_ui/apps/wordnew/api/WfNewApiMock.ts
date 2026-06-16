/**
 * WfNewApiMock — offline mock implementation of the WfNewApi contract.
 *
 * Serves the curated datasets from ../WfNewMockDb so the /wordnew app runs with
 * ZERO network access (e.g. inside AI Studio, or any sandbox with no backend).
 * It implements the exact same `WfNewApi` interface as WfNewApiHttp and uses the
 * exact same types from ./WfNewApiTypes — when you change one, change both.
 *
 * Selected via ./index.ts (swap the single import line there). See ./README.md.
 */
import type {
  WfNewApi, Word, WordGroup, BentoGroup, UserProfile, UserStats,
  SubtitleCourse, BilingualSentence, AnalyticsStats,
} from './WfNewApiTypes';
import {
  MOCK_BENTO_GROUPS, MOCK_VOCABULARY_MAP, MOCK_WALKMAN_WORDS,
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
} from '../WfNewMockDb';

/** Simulate a little network latency so loading states are exercised. */
const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** Generic dictionary pool used for search + unknown-group fallback. */
const DEFAULT_WORD_POOL: Word[] = [
  { id: 'all-1', text: 'Aesthetics', phonetic: '/esˈθet.ɪks/', translation: '美学，审美', definition: 'Concerned with the appreciation of beauty.', example: 'The grid displays classical aesthetics.', masteryLevel: 80, tags: ['Aesthetics'] },
  { id: 'all-2', text: 'Glow', phonetic: '/ɡləʊ/', translation: '发光', definition: 'Produce a steady radiant light without flame.', example: 'The aurora produced a glowing halo.', masteryLevel: 95, tags: ['Cosmic'] },
  { id: 'all-3', text: 'Cognition', phonetic: '/kɒɡˈnɪʃ.ən/', translation: '认知', definition: 'The mental action of acquiring knowledge.', example: 'AI models replicate parts of human cognition.', masteryLevel: 72, tags: ['Psychology'] },
  { id: 'all-4', text: 'Nebula', phonetic: '/ˈneb.jə.lə/', translation: '星云', definition: 'A vast cloud of gas in outer space.', example: 'The telescope captured a nebula.', masteryLevel: 65, tags: ['Cosmic'] },
  { id: 'all-5', text: 'Ephemeral', phonetic: '/ɪˈfem.ər.əl/', translation: '短暂的', definition: 'Lasting for a very short time.', example: 'Auroras are ephemeral spectacles.', masteryLevel: 58, tags: ['Literature'] },
  { id: 'all-6', text: 'Symmetrical', phonetic: '/sɪˈmet.rɪ.kəl/', translation: '对称的', definition: 'Made of mirror-like identical components.', example: 'Symmetrical layouts feel restful.', masteryLevel: 90, tags: ['Design'] },
];

/** Every mock vocabulary word, flattened — the search corpus. */
const ALL_MOCK_WORDS: Word[] = [
  ...DEFAULT_WORD_POOL,
  ...Object.values(MOCK_VOCABULARY_MAP).flat(),
  ...MOCK_WALKMAN_WORDS,
];

export const wfNewApiMock: WfNewApi = {
  getBentoGroups: () => delay([...MOCK_BENTO_GROUPS] as BentoGroup[]),

  getWordGroups: () =>
    delay(
      MOCK_BENTO_GROUPS.map<WordGroup>((g) => ({
        id: g.id, name: g.name, language: g.language,
        count: g.count, progress: g.progress, type: g.type, description: g.description,
      })),
    ),

  getVocabulary: (groupId: string) =>
    delay(MOCK_VOCABULARY_MAP[groupId] ?? DEFAULT_WORD_POOL),

  getUserProfile: (): Promise<UserProfile | null> =>
    delay({
      nickname: 'WordFlow Commander',
      learned_words: 432,
      streak: 8,
      dailyProgress: 12,
      dailyGoal: 20,
    }),

  getUserStats: (): Promise<UserStats> =>
    delay({ learned: 432, streak: 8, dailyGoal: 20, dailyProgress: 12 }),

  searchDictionary: (text: string) => {
    const q = (text || '').trim();
    if (!q) return delay<Word[]>([]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return delay(ALL_MOCK_WORDS.filter((w) => re.test(w.text) || re.test(w.translation)));
  },

  getWalkmanWords: () => delay([...MOCK_WALKMAN_WORDS]),

  getSubtitleCourses: (): Promise<SubtitleCourse[]> => delay([...MOCK_SUBTITLE_COURSES]),

  getAnalytics: (): Promise<AnalyticsStats> => delay({ ...MOCK_ANALYTICS_STATS }),

  getBilingualSentences: (): Promise<BilingualSentence[]> => delay([...MOCK_BILINGUAL_SENTENCES]),
};
