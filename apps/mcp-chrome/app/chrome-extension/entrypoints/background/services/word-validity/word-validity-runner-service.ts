/**
 * Word-Validity Runner Service (client-driven, recursive)
 *
 * A background singleton that DRAINS the backend's unchecked-word backlog on its
 * own, without the global-task lane. Unlike WordValidityWebWorkerService (which
 * pulls `word_validity` tasks off the remote_validity lane), this runner talks
 * directly to the vocabulary validity endpoints. Every unchecked word is
 * verified exactly once:
 *
 *   loop:
 *     GET  /api/app_qy_v1/vocabulary/validity/pending?language&limit=<batch_size>
 *     -> if zero words everywhere: IDLE — keep running, re-poll every
 *        word_validity.idle_poll_seconds without touching the web-AI tab.
 *     runWordValidityClassification(words, deepseek)  (verdict + translation)
 *     POST /api/app_qy_v1/vocabulary/validity/report  (valid + invalid together,
 *                                                      source = ai_ensure)
 *
 * Convergence guard (critical): a batch that classifies ZERO of the requested
 * words (parse miss / empty answer) must NOT loop forever. After 2 consecutive
 * empty rounds the runner stops with an error status. A max-rounds cap and a
 * stop() flag (checked each iteration) are additional stop conditions.
 *
 * The shared runtime also serves the production lane and Extension test panel.
 */

import { BaseApiClient, type ApiResponse } from '../../api/BaseApiClient';
import { apiManager } from '@/services/ApiManager';
import { getValidityProvider, getValidityLanguages, type AiWebProvider } from '@/services/AiProviderSettings';
import type { ClassifierWord } from './word-validity-classifier';
import { runWordValidityClassification } from './word-validity-web-runtime';
import { logger } from '@/utils/logger';
import { DEFAULT_TARGET_LANG, type ValidityStatus } from '@/utils/task-center-types';
import { VALIDITY_PATHS } from '@/utils/api-paths';
import { submitOutbox } from '../outbox/submit-outbox';
import { WORD_VALIDITY_CONFIG } from '@/utils/queue-center-contract';

const LOG = 'Word-Validity Runner';

// Safety caps. Batch size and idle cadence come from the shared Queue Center
// contract (config/queue_center_contract.json `word_validity`).
const DEFAULT_LIMIT = WORD_VALIDITY_CONFIG.batch_size;
const IDLE_POLL_MS = Math.max(5, WORD_VALIDITY_CONFIG.idle_poll_seconds) * 1000;
const MAX_ROUNDS = 500;
const MAX_CONSECUTIVE_EMPTY = 2;

export interface ValidityRunnerConfig {
  /** Laravel base URL; falls back to apiManager.getCurrentBaseUrl() when absent. */
  apiUrl?: string;
  /** Language whose unchecked words to drain (default: the persisted Settings
   *  selection, EN unless the user opted into another language). */
  language?: string;
  /** Multi-select drain list (2.4); overrides `language` when non-empty. */
  languages?: string[];
  /** Web-AI provider driving the classification (default: the persisted
   *  Settings selection, DeepSeek web unless changed). */
  provider?: AiWebProvider;
  /** Target language for valid-word translations (default DEFAULT_TARGET_LANG). */
  targetLanguage?: string;
  /** Words per round (clamped to the contract word_validity batch size). */
  limit?: number;
}

// The runner's status IS the shared ValidityStatus (with a concrete language).
// Centralized in utils/task-center-types.ts so the popup consumes one shape.
export type ValidityRunnerStatus = ValidityStatus & { language: string; languages: string[] };

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
  ): Promise<ApiResponse<{ words?: PendingWord[] }>> {
    return this.get<{ words?: PendingWord[] }>(
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
  private runEpoch = 0;
  private status: ValidityRunnerStatus = {
    running: false,
    done: false,
    idle: false,
    rounds: 0,
    totalValid: 0,
    totalInvalid: 0,
    lastError: null,
    language: 'en',
    languages: ['en'],
  };

  /**
   * Start the drain loop. Returns immediately; the loop runs in the background
   * and updates status. A second start() while running is a no-op.
   */
  async start(config: ValidityRunnerConfig = {}): Promise<void> {
    let runEpoch = 0;

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

    const languages = (config.languages && config.languages.length > 0)
      ? config.languages
      : config.language
        ? [config.language]
        : await getValidityLanguages();
    const provider = config.provider || await getValidityProvider();
    const targetLanguage = config.targetLanguage || DEFAULT_TARGET_LANG;
    const limit = Math.max(1, Math.min(DEFAULT_LIMIT, Math.floor(config.limit ?? DEFAULT_LIMIT)));

    this.running = true;
    this.stopRequested = false;
    runEpoch = ++this.runEpoch;
    this.status = {
      running: true,
      done: false,
      idle: false,
      rounds: 0,
      totalValid: 0,
      totalInvalid: 0,
      lastError: null,
      language: languages[0],
      languages,
    };

    logger.info(LOG, `Started (languages=${languages.join(',')}, provider=${provider}, target=${targetLanguage}, base=${apiBase})`);
    // Fire and forget: don't block the message handler on the whole drain.
    void this.runLoop(
      new ValidityApiClient(apiBase),
      languages,
      provider,
      targetLanguage,
      limit,
      runEpoch,
    );
  }

  /** Stop readiness immediately and invalidate every continuation from this run. */
  stop(): void {
    const wasRunning = this.running;

    this.runEpoch++;
    this.stopRequested = true;
    this.running = false;
    this.status.running = false;
    this.status.idle = false;
    if (wasRunning) logger.info(LOG, 'Stop requested');
  }

  getStatus(): ValidityRunnerStatus {
    return { ...this.status };
  }

  private async runLoop(
    client: ValidityApiClient,
    languages: string[],
    provider: AiWebProvider,
    targetLanguage: string,
    limit: number,
    runEpoch: number,
  ): Promise<void> {
    let consecutiveEmpty = 0;
    const drained = new Set<string>();
    try {
      while (this.isRunActive(runEpoch) && this.status.rounds < MAX_ROUNDS) {
        // 1. Pull the next batch of unchecked words from the next language
        // whose backlog is not drained yet (round-robin across the selection).
        const language = languages.find((lang) => !drained.has(lang));
        if (!language) {
          // Backend fully verified: IDLE. Keep the run alive and re-poll on the
          // contract cadence — new unchecked words (imports, uploads) are picked
          // up without a watchdog restart, and the web-AI tab is never touched
          // while the backlog is empty.
          this.status.done = true;
          this.status.idle = true;
          logger.info(LOG, `Backlog drained after ${this.status.rounds} round(s); idle-polling every ${IDLE_POLL_MS / 1000}s`);
          await this.idleWait(runEpoch);
          if (!this.isRunActive(runEpoch)) break;
          drained.clear();
          this.status.idle = false;
          continue;
        }
        this.status.done = false;
        this.status.idle = false;
        this.status.language = language;

        const pending = await client.fetchPending(language, limit);
        if (!this.isRunActive(runEpoch)) break;
        const words = this.extractPending(pending);
        if (words.length === 0) {
          drained.add(language);
          logger.info(LOG, `${language}: backlog drained`);
          continue;
        }
        // Only classification rounds count against MAX_ROUNDS — idle re-pulls
        // of an already-drained backlog must not trip the safety cap.
        this.status.rounds++;

        // 2. Classify via the configured web-AI tab (DeepSeek by default).
        let classification;
        try {
          classification = await runWordValidityClassification(
            words,
            provider,
            targetLanguage,
          );
        } catch (error: any) {
          if (!this.isRunActive(runEpoch)) break;
          this.status.lastError = error?.message || 'Web-AI tab drive failed';
          logger.error(LOG, `Round ${this.status.rounds}: ${this.status.lastError}`);
          break;
        }
        if (!this.isRunActive(runEpoch)) break;

        const { valid, invalid } = classification;
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

        // 4. Report valid + invalid together, md5-keyed, marked as AI-verified.
        const results = this.buildResults(valid, invalid);
        const reportBody = { language, target_language: targetLanguage, source: WORD_VALIDITY_CONFIG.source_marker, results };
        if (!this.isRunActive(runEpoch)) break;
        try {
          await client.report(reportBody);
        } catch (error: any) {
          if (!this.isRunActive(runEpoch)) break;
          // Hand the md5-keyed report to the persistent outbox, then stop this
          // round. Continuing would immediately pull and re-run the same batch
          // because Laravel has not committed its report yet. The Task Center
          // watchdog restarts the runner after the outbox has time to drain.
          await submitOutbox.enqueue({
            kind: 'validity_report',
            baseUrl: client.getBaseUrl(),
            payload: reportBody,
          });
          this.status.lastError = error?.message || 'Validity report deferred to outbox';
          logger.warn(
            LOG,
            `Round ${this.status.rounds}: report deferred to outbox (${error?.message || 'failed'})`,
          );
          break;
        }
        if (!this.isRunActive(runEpoch)) break;

        this.status.totalValid += valid.length;
        this.status.totalInvalid += invalid.length;
        logger.info(
          LOG,
          `Round ${this.status.rounds}: +${valid.length} valid, +${invalid.length} invalid (totals ${this.status.totalValid}/${this.status.totalInvalid})`,
        );
      }

      if (runEpoch === this.runEpoch && this.status.rounds >= MAX_ROUNDS && !this.status.done) {
        this.status.lastError = this.status.lastError || `Stopped at max rounds (${MAX_ROUNDS})`;
        logger.warn(LOG, this.status.lastError ?? 'Stopped at max rounds');
      }
    } catch (error: any) {
      if (runEpoch === this.runEpoch) {
        this.status.lastError = error?.message || 'Runner loop crashed';
        logger.error(LOG, this.status.lastError ?? 'Runner loop crashed');
      }
    } finally {
      if (runEpoch === this.runEpoch) {
        this.running = false;
        this.status.running = false;
        logger.info(LOG, 'Runner stopped');
      }
    }
  }

  private isRunActive(runEpoch: number): boolean {
    return this.running && !this.stopRequested && runEpoch === this.runEpoch;
  }

  /** Sleep one idle-poll cadence, waking early when the run is superseded. */
  private async idleWait(runEpoch: number): Promise<void> {
    const deadline = Date.now() + IDLE_POLL_MS;
    while (this.isRunActive(runEpoch) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /** Tolerantly pull the words array out of the {success,data:{items}} envelope. */
  private extractPending(resp: ApiResponse<{ words?: PendingWord[] }>): PendingWord[] {
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

}

// Singleton instance.
export const wordValidityRunnerService = new WordValidityRunnerService();
