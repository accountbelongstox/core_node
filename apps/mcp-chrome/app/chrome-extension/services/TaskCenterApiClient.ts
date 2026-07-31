import { BaseApiClient } from '@/entrypoints/background/api/BaseApiClient';
import { ASSIST_PATHS, TASK_CENTER_OVERVIEW_PATH, TASK_LIST_PATH } from '@/utils/api-paths';
import type { QueueLiveCounts, TaskRow, TaskStatus } from '@/utils/queue-center-contract';

interface TaskListPayload {
  tasks?: TaskRow[];
}

interface TaskCenterOverviewPayload {
  queue?: {
    by_type?: Record<string, QueueLiveCounts>;
    summary_by_type?: Record<string, QueueLiveCounts>;
  };
}

export interface TaskCenterSnapshot {
  tasks: TaskRow[];
  summaryByType: Record<string, QueueLiveCounts> | null;
}

export interface AssistCategoryItem {
  id: number | string;
  task_id?: string;
  category: string;
  task_type: string;
  status: string;
  priority: number;
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
    const [tasks, summaryByType] = await Promise.all([
      this.listTasks(limit),
      this.summaryByType(),
    ]);
    return { tasks, summaryByType };
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

  private async summaryByType(): Promise<Record<string, QueueLiveCounts> | null> {
    try {
      const response = await this.get<TaskCenterOverviewPayload>(
        TASK_CENTER_OVERVIEW_PATH,
        undefined,
        READ_OPTIONS,
      );
      const queue = response.data?.queue;
      return queue?.summary_by_type ?? queue?.by_type ?? null;
    } catch {
      return null;
    }
  }
}
