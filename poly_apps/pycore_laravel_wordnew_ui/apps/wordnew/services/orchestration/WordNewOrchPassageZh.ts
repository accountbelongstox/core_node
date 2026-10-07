/**
 * Chinese lines of short-passage sentences that have none (an English article without an aligned Chinese
 * reference, a prompt-rewrite result without a translation). Laravel translates them
 * (`ai_tools/translation/batch`, cached server-side); the lines are kept in the entry (`zh`, by sentence content
 * id), so the synced task config carries them to every device and a sentence is never translated twice.
 */
import { wfNewApi } from '../../api';
import { orchContentId } from '../../../../shared/orchestration/orchClipIdentity';
import { orchPool } from '../../../../shared/orchestration/orchClipResolver';
import {
  ORCH_PASSAGE_MAX_CONFIG_BYTES,
  orchPassageBytes,
  orchPassageKey,
  orchPassageZhMissing,
} from '../../../../shared/orchestration/orchPassages';
import type { OrchComposePassageRef, OrchComposeSentence, OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';

const TARGET_LANGUAGE = 'zh';
/** Texts per request (the server translates them one after another) and requests in flight. */
const BATCH_TEXTS = 6;
const BATCH_CONCURRENCY = 2;
/** A sentence the translation did not answer is asked again only after this long (per app session). */
const RETRY_AFTER_MS = 10 * 60_000;

class WordNewOrchPassageZhService {
  /** Content id -> when its translation last came back empty. */
  private readonly failedAt = new Map<string, number>();

  /**
   * Translate the passage sentences of `task` that still lack a Chinese line and keep the answers in its entries.
   * Returns the task as stored afterwards (`task` itself when nothing was added).
   */
  async fill(task: OrchComposeTask, sentences: ReadonlyArray<OrchComposeSentence>, signal?: AbortSignal): Promise<OrchComposeTask> {
    const passages = task.config.passages ?? [];
    if (passages.length === 0 || !wfNewApi.isAuthenticated()) return task;
    const now = Date.now();
    const texts = new Map<string, string>();
    const owners = new Map<string, Set<string>>();
    passages.forEach((ref) => {
      const key = orchPassageKey(ref);
      const own = new Set<string>();
      orchPassageZhMissing(sentences.filter((sentence) => sentence.passage === key), ref).forEach((sentence) => {
        const contentId = orchContentId(sentence.text);
        if (now - (this.failedAt.get(contentId) ?? 0) < RETRY_AFTER_MS) return;
        texts.set(contentId, sentence.text);
        own.add(contentId);
      });
      owners.set(key, own);
    });
    if (texts.size === 0) return task;
    const ids = [...texts.keys()];
    const batches: string[][] = [];
    for (let start = 0; start < ids.length; start += BATCH_TEXTS) batches.push(ids.slice(start, start + BATCH_TEXTS));
    const lines = new Map<string, string>();
    await orchPool(batches, async (batch) => {
      const answers = await wfNewApi.translateTexts(batch.map((id) => texts.get(id) ?? ''), TARGET_LANGUAGE).catch((error: unknown) => {
        console.warn('[OrchPassageZh] translation failed', error);
        return batch.map(() => '');
      });
      batch.forEach((id, index) => {
        if (answers[index]) lines.set(id, answers[index]);
        else this.failedAt.set(id, Date.now());
      });
    }, signal, BATCH_CONCURRENCY);
    if (lines.size === 0) return task;
    return (await this.keep(task.id, lines, owners)) ?? task;
  }

  /** Merge `lines` into the entries of the stored task (it may have been edited meanwhile), within the config room. */
  private async keep(taskId: string, lines: ReadonlyMap<string, string>, owners: ReadonlyMap<string, ReadonlySet<string>>): Promise<OrchComposeTask | null> {
    const current = await wordNewOrchTaskStore.get(taskId);
    if (!current) return null;
    const passages: OrchComposePassageRef[] = [];
    let added = false;
    const refs = current.config.passages ?? [];
    for (const ref of refs) {
      const zh = { ...(ref.zh ?? {}) };
      owners.get(orchPassageKey(ref))?.forEach((contentId) => {
        const line = lines.get(contentId);
        if (line && zh[contentId] === undefined) zh[contentId] = line;
      });
      const next = Object.keys(zh).length > 0 ? { ...ref, zh } : ref;
      const fits = orchPassageBytes([...passages, next, ...refs.slice(passages.length + 1)]) <= ORCH_PASSAGE_MAX_CONFIG_BYTES;
      added = added || (fits && Object.keys(zh).length > Object.keys(ref.zh ?? {}).length);
      passages.push(fits ? next : ref);
    }
    if (!added) return current;
    // The Chinese lines do not shape the plan hash (like phrases, they join the plan of the same composition).
    return wordNewOrchTaskStore.update(taskId, { config: { ...current.config, passages } });
  }
}

export const wordNewOrchPassageZh = new WordNewOrchPassageZhService();
