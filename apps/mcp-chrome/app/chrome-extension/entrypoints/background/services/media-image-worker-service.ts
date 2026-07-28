/**
 * Media Image Worker — book, library and word imagery via Google/Bing search.
 *
 * Fulfils:
 *   - GlobalTask `poster` on dedicated `remote_poster` lane
 *   - GlobalTask `word_media` on the fast lane (capability image)
 *   - Laravel assist pool items `cover` + `poster` via /assist/claim + /assist/submit
 *
 * Replaces pycore TMDB/OMDB + AI cover generation (delegated to mcp-chrome).
 */

import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase, SimpleWorkerConfig } from './task-center/SimpleWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { logger } from '@/utils/logger';
import {
  buildPosterQuery,
  buildVocabCoverQuery,
  resolvePosterImageFromSearch,
} from '@/utils/media-image-search';
import {
  claimAssistItems,
  releaseAssistItem,
  submitAssistCover,
  submitAssistPoster,
  looksLikeImageBase64,
  type AssistClaimItem,
  type AssistSubmitResult,
} from '@/services/assist-image-api';
import type { AssistSubmitPayload } from './outbox/submit-outbox';
import { generateViaGemini } from './gemini-image-generate';
import { submitOutbox } from './outbox/submit-outbox';

const LOG = 'Media Image';
const ASSIST_CLAIMER = 'mcp-chrome-media-image';
const ASSIST_POLL_MS = 30_000;

class MediaImageWorkerService extends SimpleWorkerBase {
  private assistTimer: ReturnType<typeof setInterval> | null = null;
  private assistBusy = false;
  private assistStats = {
    coversSubmitted: 0,
    postersSubmitted: 0,
    assistFailed: 0,
    lastAssistRun: null as number | null,
  };

  protected get processorKey(): string {
    return 'media_image';
  }

  protected get workerIdStorageKey(): string {
    return 'media_image_worker_id_base';
  }

  protected get capabilities(): WorkerCapability[] {
    return ['poster', 'image'];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_POSTER, LANES.REMOTE_FAST];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'poster' || taskType === 'word_media';
  }

  async start(config: SimpleWorkerConfig): Promise<void> {
    await super.start(config);
    this.startAssistLoop();
  }

  stop(): void {
    this.stopAssistLoop();
    super.stop();
  }

  getStatus() {
    const base = super.getStatus();
    return {
      ...base,
      stats: {
        ...base.stats,
        ...this.assistStats,
      },
    };
  }

  private startAssistLoop(): void {
    if (this.assistTimer) return;
    const tick = () => {
      if (!this.getStatus().isRunning || this.assistBusy) return;
      void this.runAssistCycle();
    };
    tick();
    this.assistTimer = setInterval(tick, ASSIST_POLL_MS);
  }

  private stopAssistLoop(): void {
    if (!this.assistTimer) return;
    clearInterval(this.assistTimer);
    this.assistTimer = null;
  }

  private async runAssistCycle(): Promise<void> {
    if (!this.config?.apiUrl || this.assistBusy) return;
    this.assistBusy = true;
    this.assistStats.lastAssistRun = Date.now();
    try {
      const items = await claimAssistItems(
        this.config.apiUrl,
        ['cover', 'poster'],
        ASSIST_CLAIMER,
        3,
      );
      if (!items.length) return;
      logger.info(LOG, `Assist claimed ${items.length} item(s)`);
      for (const item of items) {
        if (!this.getStatus().isRunning) break;
        await this.processAssistItem(item);
        await this.delay(1200);
      }
    } catch (error: any) {
      logger.warn(LOG, `Assist cycle failed: ${error?.message || String(error)}`);
    } finally {
      this.assistBusy = false;
    }
  }

  private async processAssistItem(item: AssistClaimItem): Promise<void> {
    if (!this.config?.apiUrl) return;
    const baseUrl = this.config.apiUrl;
    const started = Date.now();
    const payload = item.payload || {};

    if (item.type === 'cover') {
      const name = String(payload.name || '').trim();
      const prompt = String(payload.prompt || '').trim();
      // Laravel issues vocabulary-library covers as a GENERATION prompt
      // (AppQyV1CoverPromptBuilder, incl. size) — fulfil it via Gemini first;
      // fall back to Google/Bing search when the Gemini tab is unavailable or
      // the generation fails. Book covers carry no prompt and go straight to
      // search.
      let imageBase64: string | null = null;
      let mime: string | undefined;
      let provider = 'gemini';
      let model: string | undefined = 'gemini-web';
      if (prompt) {
        const generated = await generateViaGemini(prompt);
        if (generated) {
          imageBase64 = generated.imageBase64;
          mime = generated.mime;
        }
      }
      if (!imageBase64) {
        const query = buildVocabCoverQuery(name, prompt);
        const image = await resolvePosterImageFromSearch(query, { waitForVerification: false });
        if (!image) {
          this.assistStats.assistFailed += 1;
          await releaseAssistItem(baseUrl, 'cover', item.id, 'mcp-chrome: no cover image found');
          return;
        }
        imageBase64 = image.imageBase64;
        mime = image.mime;
        provider = image.provider;
        model = image.engine;
      }
      if (!imageBase64 || !looksLikeImageBase64(imageBase64)) {
        // Bad bytes (SVG/HTML error page/…) would be rejected server-side as
        // 'invalid' forever — release the claim instead of poisoning the outbox.
        this.assistStats.assistFailed += 1;
        await releaseAssistItem(baseUrl, 'cover', item.id, 'mcp-chrome: cover image failed magic validation');
        return;
      }
      const extras = { mime, provider, model, latencyMs: Date.now() - started };
      const result = await submitAssistCover(baseUrl, item.id, imageBase64, ASSIST_CLAIMER, extras);
      await this.finalizeAssistSubmit(result, {
        onOk: () => {
          this.assistStats.coversSubmitted += 1;
          logger.info(LOG, `Assist cover#${item.id} submitted${result.already_done ? ' (already done)' : ''}`);
        },
        release: () => releaseAssistItem(baseUrl, 'cover', item.id,
          `mcp-chrome: submit ${result.status}: ${result.error || 'rejected'}`),
        outboxPayload: { type: 'cover', id: item.id, imageBase64, claimer: ASSIST_CLAIMER, extras },
      });
      return;
    }

    if (item.type === 'poster') {
      const mediaType = (item.media_type === 'subtitle' ? 'subtitle' : 'book') as 'book' | 'subtitle';
      const title = String(payload.title || '').trim();
      const yearRaw = payload.year;
      const year = yearRaw == null || yearRaw === '' ? null : Number(yearRaw);
      const kind = mediaType === 'book' ? 'book' : 'movie';
      const query = buildPosterQuery(title, Number.isFinite(year) ? year : null, kind);
      const image = await resolvePosterImageFromSearch(query, { waitForVerification: false });
      if (!image) {
        this.assistStats.assistFailed += 1;
        await releaseAssistItem(baseUrl, 'poster', item.id, 'mcp-chrome: no poster image found', {
          media_type: mediaType,
        });
        return;
      }
      if (!looksLikeImageBase64(image.imageBase64)) {
        // Same terminal-bytes guard as the cover path (see above).
        this.assistStats.assistFailed += 1;
        await releaseAssistItem(baseUrl, 'poster', item.id, 'mcp-chrome: poster image failed magic validation', {
          media_type: mediaType,
        });
        return;
      }
      const extras = {
        mime: image.mime,
        provider: image.provider,
        sourceId: image.sourceUrl.slice(0, 512),
        latencyMs: Date.now() - started,
      };
      const result = await submitAssistPoster(baseUrl, mediaType, item.id, image.imageBase64, ASSIST_CLAIMER, extras);
      await this.finalizeAssistSubmit(result, {
        onOk: () => {
          this.assistStats.postersSubmitted += 1;
          logger.info(LOG, `Assist poster#${item.id} (${mediaType}) submitted${result.already_done ? ' (already done)' : ''}`);
        },
        release: () => releaseAssistItem(baseUrl, 'poster', item.id,
          `mcp-chrome: submit ${result.status}: ${result.error || 'rejected'}`, { media_type: mediaType }),
        outboxPayload: {
          type: 'poster', media_type: mediaType, id: item.id,
          imageBase64: image.imageBase64, claimer: ASSIST_CLAIMER, extras,
        },
      });
    }
  }

  /**
   * Shared outcome handling for an assist cover/poster submit:
   *   ok/already_done -> onOk();
   *   'invalid'/'not_found' -> TERMINAL (the bytes can never pass) -> release();
   *   anything else (transient) -> durable outbox retry (never lost).
   */
  private async finalizeAssistSubmit(
    result: AssistSubmitResult,
    actions: {
      onOk: () => void;
      release: () => Promise<void>;
      outboxPayload: AssistSubmitPayload;
    },
  ): Promise<void> {
    if (result.ok) {
      actions.onOk();
      return;
    }
    this.assistStats.assistFailed += 1;
    if (result.status === 'invalid' || result.status === 'not_found') {
      await actions.release();
      return;
    }
    if (!this.config?.apiUrl) return;
    await submitOutbox.enqueue({
      kind: 'assist_submit',
      baseUrl: this.config.apiUrl,
      payload: actions.outboxPayload,
    });
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as Record<string, unknown>) || {};
    if (task.task_type === 'word_media') {
      await this.executeWordMediaTask(task, payload);
      return;
    }
    const mediaType = payload.media_type === 'subtitle' ? 'subtitle' : 'book';
    const title = String(payload.title || payload.name || '').trim();
    const yearRaw = payload.year;
    const year = yearRaw == null || yearRaw === '' ? null : Number(yearRaw);
    const kind = mediaType === 'book' ? 'book' : 'movie';
    const query = buildPosterQuery(title, Number.isFinite(year) ? year : null, kind);

    if (!query) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'poster task missing title' });
      return;
    }

    const started = Date.now();
    const image = await resolvePosterImageFromSearch(query, { waitForVerification: false });
    if (!image) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no poster image found via Google/Bing' });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      image_base64: image.imageBase64,
      poster_base64: image.imageBase64,
      mime: image.mime,
      provider: image.provider,
      source_id: image.sourceUrl.slice(0, 512),
      poster_url: image.sourceUrl,
      image_url: image.sourceUrl,
      media_type: mediaType,
      query,
      latency_ms: Date.now() - started,
    });
    logger.info(LOG, `Poster task ${task.task_id} completed (${mediaType})`);
  }

  private async executeWordMediaTask(task: Task, payload: Record<string, unknown>): Promise<void> {
    const rawWords = Array.isArray(payload.words)
      ? payload.words
      : [payload.word || payload.content].filter(Boolean);
    const words = rawWords
      .map((item) => {
        const record = item && typeof item === 'object'
          ? item as Record<string, unknown>
          : null;
        const word = String(record?.word ?? item ?? '').trim();
        const md5 = String(record?.md5 || '').trim();
        return word ? { word, md5 } : null;
      })
      .filter((item): item is { word: string; md5: string } => item !== null)
      .slice(0, 40);
    const language = String(payload.language || payload.source_language || 'en');
    const targetLanguage = String(payload.target_language || 'zh');
    const translations: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (const item of words) {
      const query = buildVocabCoverQuery(item.word, `${language} word meaning illustration`);
      const image = await resolvePosterImageFromSearch(query, { waitForVerification: false });
      if (!image) {
        errors.push(`${item.word}: no image found`);
        continue;
      }
      translations.push({
        word: item.word,
        ...(item.md5 ? { md5: item.md5 } : {}),
        translation: '',
        image_base64: [{ base64: image.imageBase64, mime: image.mime }],
        provider: image.provider,
        model: image.engine,
        source_url: image.sourceUrl,
      });
      await this.delay(600);
    }

    if (!translations.length) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: errors.join('; ') || 'word_media task has no words',
      });
      return;
    }
    await this.submitResult(task.task_id, 'completed', {
      translations,
      target_language: targetLanguage,
      provider: 'mcp-chrome-search',
      errors,
    });
    logger.info(LOG, `Word-media task ${task.task_id} completed (${translations.length}/${words.length})`);
  }
}

export const mediaImageWorkerService = new MediaImageWorkerService();
