import type { WfNewPhrase, WfNewSentencePhraseStatus, WfNewSentencePhrases } from '../types/phrases';
import { APPQYV1_PHRASES_BY_SENTENCES_MAX_IDS } from '../../../../core/contracts/AppQyV1AiToolsContract';
import { WfNewApiPaths } from '../WfNewApiPaths';
import { authedPostJSON, getFreshJSON, unwrapEnvelope } from '../WfNewApiTransport';

/** Most sentence content ids one `phrases_by_sentences` request carries. */
export const PHRASES_BY_SENTENCES_MAX_IDS = APPQYV1_PHRASES_BY_SENTENCES_MAX_IDS;

const HTTP_NOT_FOUND = 404;
const STATUSES: ReadonlySet<string> = new Set<WfNewSentencePhraseStatus>(['done', 'none', 'failed', 'pending', 'unknown']);

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toPhrase(raw: any): WfNewPhrase | null {
  const phraseText = text(raw?.text).trim();
  const contentId = text(raw?.content_id);
  if (!phraseText || !contentId) return null;
  const version = Number(raw?.version);
  return {
    contentId,
    text: phraseText,
    meaning: text(raw?.meaning).trim(),
    hasAudio: raw?.has_audio === true,
    version: Number.isFinite(version) && version > 0 ? version : null,
  };
}

function toStatus(value: unknown): WfNewSentencePhraseStatus {
  return typeof value === 'string' && STATUSES.has(value) ? value as WfNewSentencePhraseStatus : 'unknown';
}

/** One answer item per requested id, in request order; an id the server did not answer is `unknown`. */
export function toSentencePhrases(contentIds: readonly string[], raw: any): WfNewSentencePhrases[] {
  const answered = new Map<string, any>();
  (Array.isArray(raw?.items) ? raw.items : []).forEach((item: any) => { if (text(item?.content_id)) answered.set(text(item.content_id), item); });
  return contentIds.map((contentId) => {
    const item = answered.get(contentId);
    return {
      contentId,
      status: item ? toStatus(item.status) : 'unknown',
      phrases: (Array.isArray(item?.phrases) ? item.phrases : []).map(toPhrase).filter((phrase: WfNewPhrase | null): phrase is WfNewPhrase => phrase !== null),
    };
  });
}

export const phraseMethods = {
  async getPhrasesBySentences(language: string, contentIds: string[]): Promise<WfNewSentencePhrases[]> {
    if (contentIds.length === 0) return [];
    const ids = contentIds.slice(0, PHRASES_BY_SENTENCES_MAX_IDS);
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.phrasesBySentences, { language, content_ids: ids }));
    return toSentencePhrases(ids, res);
  },

  async requestPhraseAudio(text: string, language: string): Promise<boolean> {
    try {
      await getFreshJSON<unknown>(WfNewApiPaths.phraseAudio(text, language));
      return true;
    } catch (error) {
      // 404 is the server's "not ready, now promoted in the phrase lane" answer.
      return Number((error as { status?: unknown } | null)?.status) === HTTP_NOT_FOUND || /HTTP 404\b/.test(String((error as Error | null)?.message ?? ''));
    }
  },
};

export const mockPhraseMethods = {
  async getPhrasesBySentences(_language: string, contentIds: string[]): Promise<WfNewSentencePhrases[]> {
    return contentIds.map((contentId) => ({ contentId, status: 'none', phrases: [] }));
  },

  async requestPhraseAudio(_text: string, _language: string): Promise<boolean> {
    return true;
  },
};
