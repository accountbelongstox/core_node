import { BaseApiClient } from '@/entrypoints/background/api/BaseApiClient';
import { TASK_CENTER_OVERVIEW_PATH, TASK_LIST_PATH } from '@/utils/api-paths';
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
