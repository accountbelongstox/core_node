/**
 * Media Image Worker — book, poster and library-cover imagery via Google/Bing search.
 *
 * Fulfils:
 *   - GlobalTask `poster` and `library_cover_search` on the dedicated `remote_poster` lane
 *   - Laravel assist pool `poster` items via /assist/claim + /assist/submit
 *     (all image submits share the image pipeline with the Gemini worker)
 *
 * Replaces pycore TMDB/OMDB poster lookups (delegated to mcp-chrome).
 */

import type { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { AssistPollingWorkerBase } from './task-center/AssistPollingWorkerBase';
import { submitAssistImage } from './assist-cover-pipeline';
import { LANES } from '@/utils/task-center-lanes';
import { logger } from '@/utils/logger';
import {
  LIBRARY_COVER_TASK_TYPES,
  TASK_CAPABILITY_BY_ROLE,
  TASK_TYPE_KEYS,
  type LibraryCoverTaskPayload,
} from '@/utils/queue-center-contract';
import {
  buildLibraryCoverQuery,
  buildPosterQuery,
  resolvePosterImageFromSearch,
} from '@/utils/media-image-search';
import {
  releaseAssistItem,
  type AssistClaimItem,
  type AssistItemType,
} from '@/services/assist-image-api';

const LOG = 'Media Image';
const ASSIST_CLAIMER = 'mcp-chrome-media-image';
const RELEASE_REASON_PREFIX = 'mcp-chrome';
const SOURCE_ID_MAX_LENGTH = 512;

type PosterMediaType = 'book' | 'subtitle';

class MediaImageWorkerService extends AssistPollingWorkerBase {
  protected get processorKey(): string {
    return 'media_image';
  }


  protected get capabilities(): WorkerCapability[] {
    return [TASK_CAPABILITY_BY_ROLE.poster];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_POSTER];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected get pullTaskTypes(): string[] {
    return [TASK_TYPE_KEYS.poster, LIBRARY_COVER_TASK_TYPES.search];
  }

  protected handlesTaskType(taskType: string): boolean {
    return this.pullTaskTypes.includes(taskType);
  }

  protected get assistItemTypes(): AssistItemType[] {
    return ['poster'];
  }

  protected get assistClaimer(): string {
    return ASSIST_CLAIMER;
  }

  protected async processAssistItem(item: AssistClaimItem): Promise<void> {
    const apiUrl = this.config?.apiUrl;
    if (!apiUrl || item.type !== 'poster') return;
    const payload = item.payload || {};
    const mediaType: PosterMediaType = item.media_type === 'subtitle' ? 'subtitle' : 'book';
    const title = String(payload.title || '').trim();
    const query = this.posterQuery(mediaType, title, payload.year);
    const startedAt = Date.now();

    this.setAssistStage('image_search');
    logger.info(LOG, `Searching image for ${mediaType} poster#${item.id}`, { title, query });
    const image = await resolvePosterImageFromSearch(query);
    if (!image) {
      this.noteAssistOutcome(false);
      logger.warn(LOG, `No image found for ${mediaType} poster#${item.id}`, { title, query });
      await releaseAssistItem(apiUrl, 'poster', item.id, `${RELEASE_REASON_PREFIX}: no poster image found`, {
        media_type: mediaType,
      });
      return;
    }

    this.setAssistStage('submitting');
    const outcome = await submitAssistImage({
      baseUrl: apiUrl,
      item,
      artifact: image,
      claimer: ASSIST_CLAIMER,
      startedAt,
      releaseReasonPrefix: RELEASE_REASON_PREFIX,
    });
    this.noteAssistOutcome(outcome === 'submitted');
  }

  protected async executeTask(task: Task): Promise<void> {
    if (task.task_type === LIBRARY_COVER_TASK_TYPES.search) {
      await this.executeLibraryCoverSearch(task);
      return;
    }
    await this.executePosterTask(task);
  }

  private async executePosterTask(task: Task): Promise<void> {
    const payload = (task.payload as Record<string, unknown>) || {};
    const mediaType: PosterMediaType = payload.media_type === 'subtitle' ? 'subtitle' : 'book';
    const query = this.posterQuery(mediaType, String(payload.title || payload.name || '').trim(), payload.year);
    if (!query) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'poster task missing title' });
      return;
    }

    const startedAt = Date.now();
    const image = await resolvePosterImageFromSearch(query);
    await this.submitImageTaskResult(
      task.task_id,
      image,
      startedAt,
      'no poster image found via Google/Bing',
      image
        ? {
          source_id: image.sourceUrl.slice(0, SOURCE_ID_MAX_LENGTH),
          poster_url: image.sourceUrl,
          image_url: image.sourceUrl,
          media_type: mediaType,
          query,
        }
        : {},
    );
  }

  private async executeLibraryCoverSearch(task: Task): Promise<void> {
    const payload = (task.payload || {}) as Partial<LibraryCoverTaskPayload>;
    const query = String(payload.search_query || '').trim()
      || buildLibraryCoverQuery(String(payload.name || ''), String(payload.category || ''));
    if (!query) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'library cover task missing search_query and name',
      });
      return;
    }

    const startedAt = Date.now();
    logger.info(LOG, `Searching library cover#${payload.library_id ?? '?'}`, { query });
    const image = await resolvePosterImageFromSearch(query);
    await this.submitImageTaskResult(
      task.task_id,
      image,
      startedAt,
      'no library cover image found via Google/Bing',
    );
  }

  private posterQuery(mediaType: PosterMediaType, title: string, yearRaw: unknown): string {
    const year = yearRaw == null || yearRaw === '' ? null : Number(yearRaw);
    return buildPosterQuery(title, Number.isFinite(year) ? year : null, mediaType === 'book' ? 'book' : 'movie');
  }
}

export const mediaImageWorkerService = new MediaImageWorkerService();
