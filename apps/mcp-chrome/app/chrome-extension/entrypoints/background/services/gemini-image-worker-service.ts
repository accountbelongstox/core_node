/**
 * Gemini Image Worker Service
 *
 * Assist-only worker for word-group cover generation. It does not register or
 * pull global image tasks; individual words never own images.
 */
import { SimpleWorkerConfig } from './task-center/SimpleWorkerBase';
import { AssistOnlyWorkerBase } from './task-center/AssistOnlyWorkerBase';
import { generateViaGemini } from './gemini-image-generate';
import { logger } from '@/utils/logger';
import {
  claimAssistItems,
  releaseAssistItem,
  type AssistClaimItem,
} from '@/services/assist-image-api';
import { submitLibraryCover } from './assist-cover-pipeline';
import { vocabularyCoverPromptLibrary } from '@/utils/vocabulary-cover-prompt-library';

const LOG = 'Gemini Image';
const ASSIST_CLAIMER = 'mcp-chrome-gemini-cover';

class GeminiImageWorkerService extends AssistOnlyWorkerBase<Record<string, unknown>> {
  protected readonly assistStats = {
    coversSubmitted: 0,
    assistFailed: 0,
    lastAssistRun: null as number | null,
    lastAssistError: null as string | null,
    currentAssistItem: null as string | null,
    currentAssistStage: 'idle',
  };

  protected get processorKey(): string {
    return 'gemini_image';
  }

  protected get workerIdStorageKey(): string {
    return 'gemini_image_worker_id_base';
  }

  protected get workerLabel(): string {
    return LOG;
  }

  async start(config: SimpleWorkerConfig): Promise<void> {
    await super.start({ ...config, pollWait: 0 });
    this.startAssistPolling();
    logger.info(LOG, 'Vocabulary-cover polling activated', {
      apiUrl: config.apiUrl,
      types: ['cover'],
      intervalMs: this.assistPollIntervalMs,
    });
  }

  protected async executeAssistCycle(): Promise<void> {
    if (!this.config?.apiUrl) return;
    this.assistStats.lastAssistRun = Date.now();
    this.assistStats.lastAssistError = null;
    this.assistStats.currentAssistStage = 'claiming';
    this.stats.lastRun = this.assistStats.lastAssistRun;
    logger.debug(LOG, 'Vocabulary-cover claim cycle started', {
      apiUrl: this.config.apiUrl,
      limit: 3,
    });
    try {
      const items = await claimAssistItems(this.config.apiUrl, ['cover'], ASSIST_CLAIMER, 3);
      this.noteBackendSuccess();
      if (!items.length) {
        logger.debug(LOG, 'Vocabulary-cover claim returned no work');
        return;
      }
      logger.info(LOG, `Claimed ${items.length} vocabulary cover(s)`, {
        items: items.map((item) => ({ id: item.id, name: String(item.payload?.name || '') })),
      });
      for (const item of items) {
        if (!this.getStatus().isRunning) break;
        await this.processAssistCover(item);
        await this.delay(1200);
      }
    } catch (error: any) {
      const message = error?.message || String(error);
      this.noteBackendFailure(error);
      this.assistStats.lastAssistError = message;
      this.assistStats.currentAssistStage = 'failed';
      logger.error(LOG, `Vocabulary-cover cycle failed: ${message}`);
    } finally {
      this.assistStats.currentAssistItem = null;
      this.stats.currentTaskId = null;
      if (this.assistStats.currentAssistStage !== 'failed') {
        this.assistStats.currentAssistStage = 'idle';
      }
    }
  }

  private async processAssistCover(item: AssistClaimItem): Promise<void> {
    if (!this.config?.apiUrl) return;
    const payload = item.payload || {};
    const name = String(payload.name || '').trim();
    const prompt = vocabularyCoverPromptLibrary.compose({
      id: item.id,
      name,
      category: String(payload.category || '').trim(),
      difficulty: String(payload.difficulty || '').trim(),
    });
    const itemKey = `cover:library:${item.id}`;
    const started = Date.now();

    this.assistStats.currentAssistItem = itemKey;
    this.assistStats.currentAssistStage = 'gemini_generation';
    this.stats.currentTaskId = `assist:${itemKey}`;
    logger.info(LOG, `Generating vocabulary cover#${item.id}`, {
      name,
      promptLength: prompt.length,
    });

    const generated = await generateViaGemini(prompt);
    if (!generated) {
      this.assistStats.assistFailed += 1;
      this.stats.failed += 1;
      logger.warn(LOG, `Gemini failed to generate vocabulary cover#${item.id}`);
      await releaseAssistItem(this.config.apiUrl, 'cover', item.id, 'mcp-chrome: Gemini cover generation failed');
      return;
    }

    const extras = {
      mime: generated.mime,
      provider: 'gemini',
      model: 'gemini-web',
      latencyMs: Date.now() - started,
    };
    this.assistStats.currentAssistStage = 'submitting';
    // Magic validation + submit + release/outbox policy live in the shared
    // assist-cover pipeline (single implementation across both image workers).
    const outcome = await submitLibraryCover({
      baseUrl: this.config.apiUrl,
      itemId: item.id,
      imageBase64: generated.imageBase64,
      claimer: ASSIST_CLAIMER,
      extras,
      releaseReasonPrefix: 'mcp-chrome',
    });
    if (outcome === 'submitted') {
      this.assistStats.coversSubmitted += 1;
      this.assistStats.currentAssistStage = 'completed';
      this.stats.translated += 1;
      logger.info(LOG, `Vocabulary cover#${item.id} submitted`);
      return;
    }

    this.assistStats.assistFailed += 1;
    this.stats.failed += 1;
    if (outcome === 'outboxed') {
      logger.warn(LOG, `Vocabulary cover#${item.id} queued in the durable outbox`);
    }
  }

}

export const geminiImageWorkerService = new GeminiImageWorkerService();
