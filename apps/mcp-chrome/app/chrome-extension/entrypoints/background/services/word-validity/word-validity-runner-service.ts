/**
 * Word-Validity Runner Service (client-driven, recursive)
 *
 * A background singleton that DRAINS the backend's unchecked-word backlog on its
 * own, without the global-task lane. Unlike WordValidityWebWorkerService (which
 * pulls `word_validity` tasks off the remote_validity lane), this runner talks
 * directly to the vocabulary validity endpoints and loops until the backlog is
 * empty:
 *
 *   loop:
 *     GET  /api/app_qy_v1/vocabulary/validity/pending?language&limit=200
 *     -> if zero words: DONE (stop).
 *     buildValidityPrompt(words) -> deepseekSendPromptTool.execute(...)
 *     -> parseValidityClassification(answer, words)
 *     POST /api/app_qy_v1/vocabulary/validity/report  (valid + invalid together)
 *
 * Convergence guard (critical): a batch that classifies ZERO of the requested
 * words (parse miss / empty answer) must NOT loop forever. After 2 consecutive
 * empty rounds the runner stops with an error status. A max-rounds cap and a
 * stop() flag (checked each iteration) are additional stop conditions.
 *
 * All prompt/parse logic is REUSED from word-validity-classifier.ts so it can
 * never drift from the server-lane worker.
 */

import { BaseApiClient, type ApiResponse } from '../../api/BaseApiClient';
import { apiManager } from '@/services/ApiManager';
import { deepseekSendPromptTool } from '../../tools/browser/deepseek';
import {
  buildValidityPrompt,
  parseValidityClassification,
  type ClassifierWord,
} from './word-validity-classifier';
import { logger } from '@/utils/logger';
import { DEFAULT_TARGET_LANG, type ValidityStatus } from '@/utils/task-center-types';
import { VALIDITY_PATHS } from '@/utils/api-paths';
import { submitOutbox } from '../outbox/submit-outbox';

const LOG = 'Word-Validity Runner';

// Safety caps. A batch is 200 words; MAX_ROUNDS * 200 bounds total work per run.
const DEFAULT_LIMIT = 200;
const MAX_ROUNDS = 500;
const MAX_CONSECUTIVE_EMPTY = 2;

export interface ValidityRunnerConfig {
  /** Laravel base URL; falls back to apiManager.getCurrentBaseUrl() when absent. */
  apiUrl?: string;
  /** Language whose unchecked words to drain. */
  language?: string;
  /** Target language for valid-word translations (default DEFAULT_TARGET_LANG). */
  targetLanguage?: string;
  /** Words per round (clamped 1..200). */
  limit?: number;
}

// The runner's status IS the shared ValidityStatus (with a concrete language).
// Centralized in utils/task-center-types.ts so the popup consumes one shape.
export type ValidityRunnerStatus = ValidityStatus & { language: string };

/** One pending word row from the backend. */
interface PendingWord {
  id?: number | string;
  word: string;
  md5?: string;
}

/** One report result row. */
interface ReportResult {
  word: string;
  md5?: string;
  is_valid: boolean;
  /** Target-language translation; only set for valid words when available. */
  translation?: string;
  note?: string;
}

/**
 * Tiny client for the two vocabulary validity endpoints. Extends BaseApiClient
 * so it inherits the same {success,message,data} unwrap + retry convention used
 * everywhere else in the extension.
 */
export class ValidityApiClient extends BaseApiClient {
  async fetchPending(
    language: string,
    limit: number,
  ): Promise<ApiResponse<{ items?: PendingWord[] }>> {
    return this.get<{ items?: PendingWord[] }>(
      VALIDITY_PATHS.PENDING,
      { language, limit },
    );
  }

  async report(body: {
    language: string;
    target_language: string;
    source: string;
    results: ReportResult[];
  }): Promise<ApiResponse<any>> {
    return this.post<any>(VALIDITY_PATHS.REPORT, body);
  }
}

class WordValidityRunnerService {
  private running = false;
  private stopRequested = false;
  private status: ValidityRunnerStatus = {
    running: false,
    done: false,
    rounds: 0,
    totalValid: 0,
    totalInvalid: 0,
    lastError: null,
    language: 'en',
  };

  /**
   * Start the drain loop. Returns immediately; the loop runs in the background
   * and updates status. A second start() while running is a no-op.
   */
  async start(config: ValidityRunnerConfig = {}): Promise<void> {
    if (this.running) {
      logger.warn(LOG, 'Runner already running');
      return;
    }

    const apiBase = (config.apiUrl || apiManager.getCurrentBaseUrl() || '')
      .trim()
      .replace(/\/+$/, '');
    if (!apiBase) {
      this.status.lastError = 'No API base URL available';
      logger.error(LOG, this.status.lastError);
      throw new Error(this.status.lastError);
    }

    const language = config.language || 'en';
    const targetLanguage = config.targetLanguage || DEFAULT_TARGET_LANG;
    const limit = Math.max(1, Math.min(DEFAULT_LIMIT, Math.floor(config.limit ?? DEFAULT_LIMIT)));

    this.running = true;
    this.stopRequested = false;
    this.status = {
      running: true,
      done: false,
      rounds: 0,
      totalValid: 0,
      totalInvalid: 0,
      lastError: null,
      language,
    };

    logger.info(LOG, `Started (language=${language}, target=${targetLanguage}, base=${apiBase})`);
    // Fire and forget: don't block the message handler on the whole drain.
    void this.runLoop(new ValidityApiClient(apiBase), language, targetLanguage, limit);
  }

  /** Request a graceful stop; the loop halts before its next round. */
  stop(): void {
    if (!this.running) return;
    this.stopRequested = true;
    logger.info(LOG, 'Stop requested');
  }

  getStatus(): ValidityRunnerStatus {
    return { ...this.status };
  }

  private async runLoop(
    client: ValidityApiClient,
    language: string,
    targetLanguage: string,
    limit: number,
  ): Promise<void> {
    let consecutiveEmpty = 0;
    try {
      while (this.running && !this.stopRequested && this.status.rounds < MAX_ROUNDS) {
        this.status.rounds++;

        // 1. Pull the next batch of unchecked words.
        const pending = await client.fetchPending(language, limit);
        const words = this.extractPending(pending);
        if (words.length === 0) {
          this.status.done = true;
          logger.info(LOG, `Backlog drained after ${this.status.rounds - 1} round(s)`);
          break;
        }

        // 2. Classify via DeepSeek web tab.
        const prompt = buildValidityPrompt(words.map((w) => w.word), targetLanguage);
        let answer: string;
        try {
          const toolResult = await deepseekSendPromptTool.execute({
            prompt,
            waitForCompletion: true,
          });
          answer = this.extractDeepSeekAnswer(toolResult);
        } catch (error: any) {
          this.status.lastError = error?.message || 'DeepSeek tab drive failed';
          logger.error(LOG, `Round ${this.status.rounds}: ${this.status.lastError}`);
          break;
        }

        const { valid, invalid } = parseValidityClassification(answer, words);
        const classified = valid.length + invalid.length;

        // 3. Convergence guard: a wholly-empty round must not loop forever.
        if (classified === 0) {
          consecutiveEmpty++;
          logger.warn(
            LOG,
            `Round ${this.status.rounds}: 0/${words.length} classified (empty ${consecutiveEmpty}/${MAX_CONSECUTIVE_EMPTY})`,
          );
          if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            this.status.lastError = `Stopped: ${MAX_CONSECUTIVE_EMPTY} consecutive empty rounds (no parseable verdicts)`;
            logger.error(LOG, this.status.lastError);
            break;
          }
          continue;
        }
        consecutiveEmpty = 0;

        // 4. Report valid + invalid together, md5-keyed.
        const results = this.buildResults(valid, invalid);
        const reportBody = { language, target_language: targetLanguage, source: 'deepseek-web', results };
        try {
          await client.report(reportBody);
        } catch (error: any) {
          // Backend interrupted: don't abort the drain. Hand the md5-keyed report
          // (idempotent upsert — safe to retry forever) to the persistent outbox
          // and keep draining the backlog.
          await submitOutbox.enqueue({
            kind: 'validity_report',
            baseUrl: client.getBaseUrl(),
            payload: reportBody,
          });
          logger.warn(
            LOG,
            `Round ${this.status.rounds}: report deferred to outbox (${error?.message || 'failed'})`,
          );
        }

        this.status.totalValid += valid.length;
        this.status.totalInvalid += invalid.length;
        logger.info(
          LOG,
          `Round ${this.status.rounds}: +${valid.length} valid, +${invalid.length} invalid (totals ${this.status.totalValid}/${this.status.totalInvalid})`,
        );
      }

      if (this.status.rounds >= MAX_ROUNDS && !this.status.done) {
        this.status.lastError = this.status.lastError || `Stopped at max rounds (${MAX_ROUNDS})`;
        logger.warn(LOG, this.status.lastError);
      }
    } catch (error: any) {
      this.status.lastError = error?.message || 'Runner loop crashed';
      logger.error(LOG, this.status.lastError);
    } finally {
      this.running = false;
      this.status.running = false;
      logger.info(LOG, 'Runner stopped');
    }
  }

  /** Tolerantly pull the words array out of the {success,data:{items}} envelope. */
  private extractPending(resp: ApiResponse<{ items?: PendingWord[] }>): PendingWord[] {
    const data: any = resp?.data;
    const raw: any = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.words)
          ? data.words
          : [];
    const out: PendingWord[] = [];
    for (const item of raw as any[]) {
      if (item && typeof item.word === 'string' && item.word.trim()) {
        out.push({ id: item.id, word: item.word.trim(), md5: item.md5 });
      }
    }
    return out;
  }

  /** Merge valid/invalid verdicts into the report result rows. */
  private buildResults(valid: ClassifierWord[], invalid: ClassifierWord[]): ReportResult[] {
    const out: ReportResult[] = [];
    for (const w of valid) {
      const row: ReportResult = { word: w.word, md5: w.md5, is_valid: true };
      if (typeof w.translation === 'string' && w.translation) row.translation = w.translation;
      out.push(row);
    }
    for (const w of invalid) out.push({ word: w.word, md5: w.md5, is_valid: false });
    return out;
  }

  /** deepseek tool returns content[0].text = JSON{result:{content}}. */
  private extractDeepSeekAnswer(toolResult: any): string {
    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      throw new Error(typeof errText === 'string' ? errText : 'deepseek tool error');
    }
    const text = toolResult?.content?.[0]?.text;
    if (typeof text !== 'string' || !text) {
      throw new Error('deepseek tool returned no content');
    }
    let outer: any;
    try {
      outer = JSON.parse(text);
    } catch {
      return text;
    }
    const content = outer?.result?.content;
    if (typeof content === 'string' && content) return content;
    if (typeof outer?.result === 'string') return outer.result;
    throw new Error('deepseek tool result carried no assistant content');
  }
}

// Singleton instance.
export const wordValidityRunnerService = new WordValidityRunnerService();
