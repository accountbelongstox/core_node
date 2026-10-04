/** types/phrases.ts - phrases of sentences (contract `phrases_by_sentences`, docs_fix/DESIGN_PHRASE_PIPELINE.md §5). */

/**
 * Phrase extraction state of one sentence: `done` / `none` / `failed` are the server's `phrase_status`
 * (`none`: no phrase in it, final), `pending` is a sentence not extracted yet and `unknown` one the
 * server does not hold (yet).
 */
export type WfNewSentencePhraseStatus = 'done' | 'none' | 'failed' | 'pending' | 'unknown';

export interface WfNewPhrase {
  /** md5 content id of the phrase text (the phrase clip's identity). */
  contentId: string;
  text: string;
  /** Chinese gloss ('' when the server has none). */
  meaning: string;
  hasAudio: boolean;
  /** Content version of the phrase audio file (null while it has none). */
  version: number | null;
}

export interface WfNewSentencePhrases {
  /** Content id of the sentence the phrases belong to. */
  contentId: string;
  status: WfNewSentencePhraseStatus;
  phrases: WfNewPhrase[];
}
