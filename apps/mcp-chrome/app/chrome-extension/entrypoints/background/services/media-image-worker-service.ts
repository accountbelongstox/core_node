/**
 * Media Image Worker — book, poster and word imagery via Google/Bing search.
 *
 * Fulfils:
 *   - GlobalTask `poster` on dedicated `remote_poster` lane
 *   - GlobalTask `word_media` on the fast lane (capability image)
 *   - Laravel assist pool `poster` items via /assist/claim + /assist/submit
 *     (cover submits share the assist-cover pipeline with the Gemini worker)
 *
 * Replaces pycore TMDB/OMDB + AI cover generation (delegated to mcp-chrome).
 */

import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerConfig } from './task-center/SimpleWorkerBase';
import { AssistPollingWorkerBase } from './task-center/AssistPollingWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { logger } from '@/utils/logger';
import { TASK_CAPABILITY_BY_ROLE, TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import {
  buildPosterQuery,
  buildWordImageQuery,
  resolvePosterImageFromSearch,
} from '@/utils/media-image-search';
import {
  claimAssistItems,
  releaseAssistItem,
  submitAssistPoster,
  looksLikeImageBase64,
  type AssistClaimItem,
} from '@/services/assist-image-api';
import { finalizeAssistSubmit } from './assist-cover-pipeline';

const LOG = 'Media Image';
const ASSIST_CLAIMER = 'mcp-chrome-media-image';

class MediaImageWorkerService extends AssistPollingWorkerBase<Record<string, unknown>> {
  protected readonly assistStats = {
    postersSubmitted: 0,
    assistFailed: 0,
    lastAssistRun: null as number | null,
    lastAssistError: null as string | null,
    currentAssistItem: null as string | null,
    currentAssistStage: 'idle',
  };

  protected get processorKey(): string {
    return 'media_image';
  }

  protected get workerIdStorageKey(): string {
    return 'media_image_worker_id_base';
  }

  protected get capabilities(): WorkerCapability[] {
    return [TASK_CAPABILITY_BY_ROLE.poster, TASK_CAPABILITY_BY_ROLE.image];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_POSTER, LANES.REMOTE_FAST];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected get pullTaskTypes(): string[] {
    // word_media LAST: the high-volume primary lane.
    return [TASK_TYPE_KEYS.poster, TASK_TYPE_KEYS.word_media];
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.poster || taskType === TASK_TYPE_KEYS.word_media;
  }

  async start(config: SimpleWorkerConfig): Promise<void> {
    await super.start({ ...config, pollWait: 0 });
    this.startAssistPolling();
    logger.info(LOG, 'Assist polling activated', {
      apiUrl: config.apiUrl,
      types: ['poster'],
      intervalMs: this.assistPollIntervalMs,
    });
  }

  protected async executeAssistCycle(): Promise<void> {
    if (!this.config?.apiUrl) return;
    this.assistStats.lastAssistRun = Date.now();
    this.assistStats.lastAssistError = null;
    this.assistStats.currentAssistStage = 'claiming';
    this.stats.lastRun = this.assistStats.lastAssistRun;
    logger.debug(LOG, 'Assist claim cycle started', {
      apiUrl: this.config.apiUrl,
      types: ['poster'],
      limit: 3,
    });
    try {
      const items = await claimAssistItems(
        this.config.apiUrl,
        ['poster'],
        ASSIST_CLAIMER,
        3,
      );
      this.noteBackendSuccess();
      if (!items.length) {
        logger.debug(LOG, 'Assist claim returned no work');
        return;
      }
      logger.info(LOG, `Assist claimed ${items.length} item(s)`, {
        items: items.map((item) => ({
          type: item.type,
          mediaType: item.media_type || null,
          id: item.id,
          title: String(item.payload?.title || item.payload?.name || ''),
        })),
      });
      for (const item of items) {
        if (!this.getStatus().isRunning) break;
        const itemKey = `${item.type}:${item.media_type || 'library'}:${item.id}`;
        this.assistStats.currentAssistItem = itemKey;
        this.assistStats.currentAssistStage = 'processing';
        this.stats.currentTaskId = `assist:${itemKey}`;
        try {
          await this.processAssistItem(item);
        } finally {
          this.assistStats.currentAssistItem = null;
          this.assistStats.currentAssistStage = 'idle';
          this.stats.currentTaskId = null;
        }
        await this.delay(1200);
      }
    } catch (error: any) {
      const message = error?.message || String(error);
      this.noteBackendFailure(error);
      this.assistStats.lastAssistError = message;
      this.assistStats.currentAssistStage = 'failed';
      logger.error(LOG, `Assist cycle failed: ${message}`, {
        apiUrl: this.config.apiUrl,
      });
    } finally {
      if (!this.assistStats.currentAssistItem && this.assistStats.currentAssistStage !== 'failed') {
        this.assistStats.currentAssistStage = 'idle';
      }
    }
  }

  private async processAssistItem(item: AssistClaimItem): Promise<void> {
    if (!this.config?.apiUrl) return;
    const baseUrl = this.config.apiUrl;
    const started = Date.now();
    const payload = item.payload || {};
    logger.info(LOG, `Processing assist ${item.type}#${item.id}`, {
      mediaType: item.media_type || null,
      title: String(payload.title || payload.name || ''),
    });

    if (item.type === 'poster') {
      const mediaType = (item.media_type === 'subtitle' ? 'subtitle' : 'book') as 'book' | 'subtitle';
      const title = String(payload.title || '').trim();
      const yearRaw = payload.year;
      const year = yearRaw == null || yearRaw === '' ? null : Number(yearRaw);
      const kind = mediaType === 'book' ? 'book' : 'movie';
      const query = buildPosterQuery(title, Number.isFinite(year) ? year : null, kind);
      this.assistStats.currentAssistStage = 'image_search';
      logger.info(LOG, `Searching image for ${mediaType} poster#${item.id}`, { title, query });
      const image = await resolvePosterImageFromSearch(query);
      if (!image) {
        this.assistStats.assistFailed += 1;
        this.stats.failed += 1;
        logger.warn(LOG, `No image found for ${mediaType} poster#${item.id}`, { title, query });
        await releaseAssistItem(baseUrl, 'poster', item.id, 'mcp-chrome: no poster image found', {
          media_type: mediaType,
        });
        return;
      }
      if (!looksLikeImageBase64(image.imageBase64)) {
        // Same terminal-bytes guard as the cover pipeline.
        this.assistStats.assistFailed += 1;
        this.stats.failed += 1;
        logger.warn(LOG, `Image validation failed for ${mediaType} poster#${item.id}`, {
          provider: image.provider,
          mime: image.mime,
          sourceUrl: image.sourceUrl,
        });
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
      this.assistStats.currentAssistStage = 'submitting';
      logger.debug(LOG, `Submitting ${mediaType} poster#${item.id}`, extras);
      const result = await submitAssistPoster(baseUrl, mediaType, item.id, image.imageBase64, ASSIST_CLAIMER, extras);
      const outcome = await finalizeAssistSubmit(baseUrl, result, {
        onOk: () => {
          logger.info(LOG, `Backend accepted ${mediaType} poster#${item.id}${result.already_done ? ' (already done)' : ''}`, {
            status: result.status,
            provider: image.provider,
          });
        },
        release: () => releaseAssistItem(baseUrl, 'poster', item.id,
          `mcp-chrome: submit ${result.status}: ${result.error || 'rejected'}`, { media_type: mediaType }),
        outboxPayload: {
          type: 'poster', media_type: mediaType, id: item.id,
          imageBase64: image.imageBase64, claimer: ASSIST_CLAIMER, extras,
        },
      });
      if (outcome === 'submitted') {
        this.assistStats.postersSubmitted += 1;
        this.stats.translated += 1;
        this.assistStats.currentAssistStage = 'completed';
      } else {
        this.assistStats.assistFailed += 1;
        this.stats.failed += 1;
      }
    }
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as Record<string, unknown>) || {};
    if (task.task_type === TASK_TYPE_KEYS.word_media) {
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
    const image = await resolvePosterImageFromSearch(query);
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
    const targetLanguage = String(payload.target_language || 'zh');
    const translations: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (const item of words) {
      const query = buildWordImageQuery(item.word);
      const image = await resolvePosterImageFromSearch(query);
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
