/**
 * Gemini Image Worker Service
 *
 * Registered `remote_gemini` worker (capability image) and the single
 * extension consumer of Gemini image generation:
 *   - GlobalTask `library_cover` (vocabulary-library cover, AI generate mode)
 *   - GlobalTask `gemini_image` (explicit prompt-driven image requests)
 *   - Laravel assist pool `cover` items (background fill of missing covers)
 * Individual words never own images.
 */
import type { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { AssistPollingWorkerBase } from './task-center/AssistPollingWorkerBase';
import { generateViaGemini, type GeminiGeneratedImage } from './gemini-image-generate';
import { submitAssistImage, type ImageArtifact } from './assist-cover-pipeline';
import { LANES } from '@/utils/task-center-lanes';
import { logger } from '@/utils/logger';
import {
  LIBRARY_COVER_TASK_TYPES,
  TASK_CAPABILITY_BY_ROLE,
  TASK_TYPE_KEYS,
  taskPromptText,
  type LibraryCoverTaskPayload,
} from '@/utils/queue-center-contract';
import {
  releaseAssistItem,
  type AssistClaimItem,
  type AssistItemType,
} from '@/services/assist-image-api';
import { vocabularyCoverPromptLibrary } from '@/utils/vocabulary-cover-prompt-library';

const LOG = 'Gemini Image';
const ASSIST_CLAIMER = 'mcp-chrome-gemini-cover';
const RELEASE_REASON_PREFIX = 'mcp-chrome';
const GEMINI_PROVIDER = 'gemini';
const GEMINI_MODEL = 'gemini-web';

class GeminiImageWorkerService extends AssistPollingWorkerBase {
  protected get processorKey(): string {
    return 'gemini_image';
  }


  protected get workerLabel(): string {
    return LOG;
  }

  protected get capabilities(): WorkerCapability[] {
    return [TASK_CAPABILITY_BY_ROLE.image];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_GEMINI];
  }

  protected get pullTaskTypes(): string[] {
    return [LIBRARY_COVER_TASK_TYPES.generate, TASK_TYPE_KEYS.gemini_image];
  }

  protected handlesTaskType(taskType: string): boolean {
    return this.pullTaskTypes.includes(taskType);
  }

  protected get assistItemTypes(): AssistItemType[] {
    return ['cover'];
  }

  protected get assistClaimer(): string {
    return ASSIST_CLAIMER;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload || {}) as Record<string, unknown>;
    const prompt = task.task_type === LIBRARY_COVER_TASK_TYPES.generate
      ? this.libraryCoverPrompt(task.task_id, payload as Partial<LibraryCoverTaskPayload>)
      : taskPromptText(task.task_type, payload).trim();
    if (!prompt) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: `${task.task_type} task has no prompt`,
      });
      return;
    }

    const startedAt = Date.now();
    logger.info(LOG, `Generating ${task.task_type} task ${task.task_id}`, {
      libraryId: payload.library_id ?? null,
      promptLength: prompt.length,
    });
    const generated = await generateViaGemini(prompt);
    await this.submitImageTaskResult(
      task.task_id,
      generated && this.toArtifact(generated, prompt),
      startedAt,
      'Gemini image generation failed',
    );
  }

  protected async processAssistItem(item: AssistClaimItem): Promise<void> {
    const apiUrl = this.config?.apiUrl;
    if (!apiUrl) return;
    const payload = item.payload || {};
    const name = String(payload.name || '').trim();
    const prompt = vocabularyCoverPromptLibrary.compose({
      id: item.id,
      name,
      category: String(payload.category || '').trim(),
      difficulty: String(payload.difficulty || '').trim(),
    });
    const startedAt = Date.now();

    this.setAssistStage('gemini_generation');
    logger.info(LOG, `Generating vocabulary cover#${item.id}`, {
      name,
      promptLength: prompt.length,
    });
    const generated = await generateViaGemini(prompt);
    if (!generated) {
      this.noteAssistOutcome(false);
      logger.warn(LOG, `Gemini failed to generate vocabulary cover#${item.id}`);
      await releaseAssistItem(apiUrl, 'cover', item.id, `${RELEASE_REASON_PREFIX}: Gemini cover generation failed`);
      return;
    }

    this.setAssistStage('submitting');
    const outcome = await submitAssistImage({
      baseUrl: apiUrl,
      item,
      artifact: this.toArtifact(generated, prompt),
      claimer: ASSIST_CLAIMER,
      startedAt,
      releaseReasonPrefix: RELEASE_REASON_PREFIX,
    });
    this.noteAssistOutcome(outcome === 'submitted');
    if (outcome === 'outboxed') {
      logger.warn(LOG, `Vocabulary cover#${item.id} queued in the durable outbox`);
    }
  }

  /**
   * An explicit payload prompt wins; otherwise compose a fresh prompt whose
   * variation is unique per run, so a regenerate never repeats the last cover.
   */
  private libraryCoverPrompt(taskId: string, payload: Partial<LibraryCoverTaskPayload>): string {
    const explicit = String(payload.prompt || '').trim();
    if (explicit) return explicit;
    return vocabularyCoverPromptLibrary.compose({
      id: Number(payload.library_id) || 0,
      name: String(payload.name || '').trim(),
      category: String(payload.category || '').trim(),
      variation: `${taskId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    });
  }

  private toArtifact(generated: GeminiGeneratedImage, prompt: string): ImageArtifact {
    return {
      ...generated,
      provider: GEMINI_PROVIDER,
      model: GEMINI_MODEL,
      prompt,
    };
  }
}

export const geminiImageWorkerService = new GeminiImageWorkerService();
