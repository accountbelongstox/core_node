import { BaseApiClient } from '@/entrypoints/background/api/BaseApiClient';
import {
  ASSIST_PATHS,
  TASK_CENTER_OVERVIEW_PATH,
  TASK_LIST_PATH,
  VALIDITY_PATHS,
} from '@/utils/api-paths';
import type { QueueLiveCounts, TaskRow, TaskStatus } from '@/utils/queue-center-contract';

interface TaskListPayload {
  tasks?: TaskRow[];
}

interface TaskCenterOverviewPayload {
  queue?: {
    by_type?: Record<string, QueueLiveCounts>;
    summary_by_type?: Record<string, QueueLiveCounts>;
  };
  realtime?: QueueCenterRealtimeConfig;
}

export interface QueueCenterRealtimeConfig {
  transport: 'websocket';
  app_key: string;
  host: string;
  port: number;
  scheme: string;
  channel: string;
  event: string;
  revision: number;
}

export interface TaskCenterSnapshot {
  tasks: TaskRow[];
  summaryByType: Record<string, QueueLiveCounts> | null;
  realtime: QueueCenterRealtimeConfig | null;
}

export interface ValidityQueueItem {
  id: number | string;
  word: string;
  md5?: string;
  language: string;
  query_count: number;
  needs_validity: boolean;
  needs_translation: boolean;
}

export interface ValidityQueuePage {
  languages: string[];
  count: number;
  total: number;
  start: number;
  limit: number;
  revision: number;
  words: ValidityQueueItem[];
}

export interface AssistCategoryItem {
  id: number | string;
  task_id?: string;
  category: string;
  task_type: string;
  status: string;
  queue_position?: number;
  priority?: number;
  content_text?: string | null;
  language?: string | null;
  media_type?: string | null;
  assigned_to?: string | null;
  retry_count?: number;
  created_at?: string | null;
}

export interface AssistCategoryPage {
  category: string;
  status: string | null;
  total: number;
  start: number;
  limit: number;
  items: AssistCategoryItem[];
}

const READ_OPTIONS = {
  headers: { 'Cache-Control': 'no-cache' },
  retries: 0,
} as const;

export class TaskCenterApiClient extends BaseApiClient {
  async listTasks(limit: number, status?: TaskStatus): Promise<TaskRow[]> {
    const response = await this.get<TaskListPayload>(
      TASK_LIST_PATH,
      { limit, status },
      READ_OPTIONS,
    );
    return Array.isArray(response.data?.tasks) ? response.data.tasks : [];
  }

  async snapshot(limit: number): Promise<TaskCenterSnapshot> {
    const [tasks, overview] = await Promise.all([
      this.listTasks(limit),
      this.overview(),
    ]);
    return {
      tasks,
      summaryByType: overview.summaryByType,
      realtime: overview.realtime,
    };
  }

  async listValidityQueue(
    languages: string[],
    start: number,
    limit: number,
    search: string,
  ): Promise<ValidityQueuePage> {
    const response = await this.get<ValidityQueuePage>(
      VALIDITY_PATHS.PENDING,
      {
        languages: languages.join(','),
        start,
        limit,
        q: search || undefined,
        include_total: true,
      },
      READ_OPTIONS,
    );
    const page = response.data;
    return {
      languages: Array.isArray(page?.languages) ? page.languages : languages,
      count: Number(page?.count ?? 0),
      total: Number(page?.total ?? 0),
      start: Number(page?.start ?? start),
      limit: Number(page?.limit ?? limit),
      revision: Number(page?.revision ?? 0),
      words: Array.isArray(page?.words) ? page.words : [],
    };
  }

  async listCategoryItems(
    category: string,
    status: string,
    start: number,
    limit: number,
    search: string,
  ): Promise<AssistCategoryPage> {
    const response = await this.get<AssistCategoryPage>(
      ASSIST_PATHS.OVERVIEW_ITEMS,
      {
        category,
        status: status === 'all' ? undefined : status,
        start,
        limit,
        q: search || undefined,
      },
      READ_OPTIONS,
    );
    const raw = response as unknown as AssistCategoryPage & { data?: AssistCategoryPage | null };
    const page = raw.data ?? raw;
    return {
      category: page.category ?? category,
      status: page.status ?? status,
      total: Number(page.total ?? 0),
      start: Number(page.start ?? start),
      limit: Number(page.limit ?? limit),
      items: Array.isArray(page.items) ? page.items : [],
    };
  }

  private async overview(): Promise<{
    summaryByType: Record<string, QueueLiveCounts> | null;
    realtime: QueueCenterRealtimeConfig | null;
  }> {
    try {
      const response = await this.get<TaskCenterOverviewPayload>(
        TASK_CENTER_OVERVIEW_PATH,
        undefined,
        READ_OPTIONS,
      );
      const queue = response.data?.queue;
      return {
        summaryByType: queue?.summary_by_type ?? queue?.by_type ?? null,
        realtime: response.data?.realtime ?? null,
      };
    } catch {
      return { summaryByType: null, realtime: null };
    }
  }
}
