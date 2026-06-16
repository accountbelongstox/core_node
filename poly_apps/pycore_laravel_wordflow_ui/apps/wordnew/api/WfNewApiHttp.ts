/**
 * WfNewApiHttp — live/real implementation of the WfNewApi contract.
 *
 * Delegates to the shared wordflow transport (`wordflowApi`, which talks to the
 * real backend behind the health-checked endpoint manager). It implements the
 * exact same `WfNewApi` interface as WfNewApiMock and returns the exact same
 * types from ./WfNewApiTypes — keep the two in lock-step.
 *
 * Coverage note (honest, no silent gaps):
 *   - REAL backend data: getWordGroups / getBentoGroups / getVocabulary /
 *     getUserProfile / getUserStats / searchDictionary / getWalkmanWords.
 *   - The interactive Subtitles / Bilingual / Analytics pages are curated
 *     CONTENT with no dedicated backend endpoint yet, so this impl serves the
 *     same curated datasets the mock uses (logged once). When a real endpoint
 *     lands, swap those three bodies to a wordflowApi call — the interface and
 *     types do not change.
 *
 * Selected via ./index.ts. See ./README.md.
 */
import type {
  WfNewApi, Word, WordGroup, BentoGroup, UserProfile, UserStats,
  SubtitleCourse, BilingualSentence, AnalyticsStats,
} from './WfNewApiTypes';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import {
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
} from '../WfNewMockDb';

// --- mappers --------------------------------------------------------------- #

/** Normalize a backend/wordflow word record into the shared Word shape. */
function toWord(raw: any, i = 0): Word {
  return {
    id: String(raw?.id ?? raw?.word_id ?? raw?.word ?? `w-${i}`),
    text: raw?.text ?? raw?.word ?? '',
    phonetic: raw?.phonetic ?? raw?.phonetics ?? '',
    translation: raw?.translation ?? raw?.meaning ?? raw?.definition_zh ?? '',
    definition: raw?.definition ?? undefined,
    example: raw?.example ?? raw?.example_sentence ?? undefined,
    exampleTranslation: raw?.exampleTranslation ?? raw?.example_translation ?? undefined,
    masteryLevel: typeof raw?.masteryLevel === 'number' ? raw.masteryLevel
      : typeof raw?.mastery_level === 'number' ? raw.mastery_level : undefined,
    wordType: raw?.wordType ?? raw?.word_type ?? raw?.pos ?? undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags : undefined,
    audioUrl: raw?.audioUrl ?? raw?.audio_url ?? undefined,
  };
}

/** Decorative carousel applied to live groups so the bento grid still varies. */
const BENTO_DECOR: Array<Pick<BentoGroup,
  'gridSpan' | 'bgGradient' | 'bgGradientDark' | 'decorColor' | 'decorativeSvg'>> = [
  { gridSpan: 'md:col-span-2 md:row-span-2 h-[340px]', bgGradient: 'from-purple-100/70 via-indigo-50/50 to-indigo-100/70', bgGradientDark: 'from-violet-950/20 via-slate-900/40 to-indigo-950/20', decorColor: 'text-indigo-400 dark:text-purple-400', decorativeSvg: 'nebula' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-emerald-50/70 to-teal-100/70', bgGradientDark: 'from-emerald-950/15 to-slate-900/40', decorColor: 'text-teal-400 dark:text-emerald-400', decorativeSvg: 'matrix' },
  { gridSpan: 'md:col-span-1 md:row-span-2 h-[345px]', bgGradient: 'from-rose-100/70 via-pink-50/50 to-orange-100/70', bgGradientDark: 'from-rose-950/15 via-slate-900/40 to-amber-950/15', decorColor: 'text-rose-400 dark:text-orange-400', decorativeSvg: 'stars' },
  { gridSpan: 'md:col-span-2 md:row-span-1 h-[160px]', bgGradient: 'from-blue-50/70 to-indigo-100/70', bgGradientDark: 'from-blue-950/15 to-slate-900/40', decorColor: 'text-blue-400 dark:text-sky-400', decorativeSvg: 'waves' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-amber-50/70 to-orange-100/70', bgGradientDark: 'from-orange-950/15 to-slate-900/40', decorColor: 'text-yellow-500 dark:text-amber-400', decorativeSvg: 'rings' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-violet-50/70 to-fuchsia-100/70', bgGradientDark: 'from-fuchsia-950/15 to-slate-900/40', decorColor: 'text-fuchsia-400', decorativeSvg: 'bars' },
];

function decorate(g: WordGroup, i: number): BentoGroup {
  const d = BENTO_DECOR[i % BENTO_DECOR.length];
  return {
    ...g,
    badge: g.type ? `★ ${g.type}` : '★ Pack',
    statsLabel: 'Synaptic Link Active',
    ...d,
  };
}

let contentFallbackLogged = false;
function logContentFallback(): void {
  if (!contentFallbackLogged) {
    contentFallbackLogged = true;
    console.info('[WfNewApiHttp] Subtitles/Bilingual/Analytics have no backend endpoint yet — serving curated content.');
  }
}

// --- implementation -------------------------------------------------------- #

export const wfNewApiHttp: WfNewApi = {
  async getBentoGroups(): Promise<BentoGroup[]> {
    const groups = await wordflowApi.getWordGroups();
    return (groups ?? []).map((g, i) => decorate(g as WordGroup, i));
  },

  async getWordGroups(): Promise<WordGroup[]> {
    return (await wordflowApi.getWordGroups()) ?? [];
  },

  async getVocabulary(groupId: string): Promise<Word[]> {
    const words = await wordflowApi.getWordsForGroup(groupId);
    return (words ?? []).map(toWord);
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const p: any = await wordflowApi.getUserProfile();
      if (!p) return null;
      return {
        nickname: p.nickname ?? p.name,
        name: p.name,
        email: p.email,
        avatar: p.avatar ?? p.avatar_url,
        learned_words: p.learned_words ?? p.totalLearned,
        totalLearned: p.totalLearned ?? p.learned_words,
        streak: p.streak,
        dailyProgress: p.dailyProgress,
        dailyGoal: p.dailyGoal,
      };
    } catch {
      return null;
    }
  },

  async getUserStats(): Promise<UserStats> {
    const p = await this.getUserProfile();
    return {
      learned: p?.learned_words ?? p?.totalLearned ?? 0,
      streak: p?.streak ?? 0,
      dailyGoal: p?.dailyGoal ?? 20,
      dailyProgress: p?.dailyProgress ?? 0,
    };
  },

  async searchDictionary(text: string): Promise<Word[]> {
    const q = (text || '').trim();
    if (!q) return [];
    try {
      const entries: any[] = await wordflowApi.queryPersonalDictionaryByWords([q]);
      return (entries ?? []).map(toWord);
    } catch {
      return [];
    }
  },

  async getWalkmanWords(): Promise<Word[]> {
    const words = await wordflowApi.getDailyWords(40);
    return (words ?? []).map(toWord);
  },

  async getSubtitleCourses(): Promise<SubtitleCourse[]> {
    logContentFallback();
    return [...MOCK_SUBTITLE_COURSES];
  },

  async getAnalytics(): Promise<AnalyticsStats> {
    logContentFallback();
    return { ...MOCK_ANALYTICS_STATS };
  },

  async getBilingualSentences(): Promise<BilingualSentence[]> {
    logContentFallback();
    return [...MOCK_BILINGUAL_SENTENCES];
  },
};
