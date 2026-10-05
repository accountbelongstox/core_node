/**
 * Phrase input of a composition run: the phrases of the plan's sentences, loaded before the plan is composed
 * (shared planner input `phrasesBySentence`: sentence content id -> phrases). Only a pattern with a `phrases` step
 * loads anything. The data model is WordNewOrchPhraseStore; this adapts it to a task's sentences.
 */
import { AUDIO_ORCH_PHRASE_PIPELINE } from '../../../../core/contracts/AudioOrchestrationContract';
import { orchPatternHasPhrases, orchSentenceContentId } from '../../../../shared/orchestration/orchPlanner';
import type { OrchComposeSentence, OrchComposeTask, OrchPhraseText } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewOrchPhraseStore } from './WordNewOrchPhraseStore';

export interface OrchPhraseInputs {
  /** Phrases per sentence content id. */
  bySentence: Map<string, OrchPhraseText[]>;
  /** Sentence content ids still without phrases on the server, per sentence language. */
  pending: Record<string, string[]>;
  /** The plan now holds a different number of phrases than the task's last plan (stage cursors are stale). */
  changed: boolean;
}

export const EMPTY_PHRASE_INPUTS: OrchPhraseInputs = { bySentence: new Map(), pending: {}, changed: false };

/** Sentence content ids per phrase-capable language. */
function sentenceIdsByLanguage(sentences: readonly OrchComposeSentence[]): Map<string, string[]> {
  const byLanguage = new Map<string, string[]>();
  sentences.forEach((sentence) => {
    if (!sentence.text.trim() || !AUDIO_ORCH_PHRASE_PIPELINE.languages.includes(sentence.language)) return;
    byLanguage.set(sentence.language, [...(byLanguage.get(sentence.language) ?? []), orchSentenceContentId(sentence)]);
  });
  return byLanguage;
}

export function pendingPhraseCount(pending: Record<string, string[]>): number {
  return Object.values(pending).reduce((total, ids) => total + ids.length, 0);
}

/** Phrases for a task's sentences (local answers first; only not-final sentences are asked, and only while Laravel answers). */
export async function loadOrchPhraseInputs(task: OrchComposeTask, sentences: readonly OrchComposeSentence[], signal?: AbortSignal): Promise<OrchPhraseInputs> {
  if (!orchPatternHasPhrases(task.config.pattern)) return EMPTY_PHRASE_INPUTS;
  const ask = wfNewApi.isAuthenticated() && wordNewChannels.laravel();
  const bySentence = new Map<string, OrchPhraseText[]>();
  const pending: Record<string, string[]> = {};
  for (const [language, ids] of sentenceIdsByLanguage(sentences)) {
    const resolution = await wordNewOrchPhraseStore.resolve(language, ids, { signal, ask });
    resolution.bySentence.forEach((phrases, id) => bySentence.set(id, phrases));
    if (resolution.pending.length > 0) pending[language] = resolution.pending;
  }
  let count = 0;
  bySentence.forEach((phrases) => { count += phrases.length; });
  return { bySentence, pending, changed: await wordNewOrchPhraseStore.notePlanned(task.id, count) };
}

/** One cheap re-check of the pending sentences: the ones that are final now, and what is still pending. */
export async function refreshOrchPhrasePending(
  pending: Record<string, string[]>,
  signal?: AbortSignal,
): Promise<{ resolved: number; pending: Record<string, string[]> }> {
  const next: Record<string, string[]> = {};
  let resolved = 0;
  if (!wfNewApi.isAuthenticated() || !wordNewChannels.laravel()) return { resolved, pending };
  for (const [language, ids] of Object.entries(pending)) {
    const result = await wordNewOrchPhraseStore.refresh(language, ids, signal);
    resolved += result.resolved.length;
    if (result.pending.length > 0) next[language] = result.pending;
  }
  return { resolved, pending: next };
}
