/**
 * Worker API Client
 * Implements Worker Task System API according to BACKEND_WORKER_API.md
 * Under 300 lines
 */

import { BaseApiClient, ApiResponse } from './BaseApiClient';

// ========== Type Definitions ==========

export type ProcessorType =
  | 'remote_client'
  | 'remote_compute'
  | 'remote_ocr'
  | 'remote_translation'
  | 'remote_video'
  | 'remote_io';

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'processing'
  | 'completed'
  | 'completed_demo'
  | 'failed'
  | 'cancelled';

export interface WorkerRegistration {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  hostname?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

export interface Task {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  status: TaskStatus;
  payload: {
    words?: Array<{
      word: string;
      md5: string;
      query_count: number;
    }>;
    language?: string;
    is_demo_mode?: boolean;
    word_count?: number;
    [key: string]: any;
  };
  timeout_seconds: number;
  priority: number;
  created_at: string;
}

export interface TaskResult {
  task_id: string;
  worker_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    explanations?: Array<{
      word: string;
      md5: string;
      explanation: string;
      phonetic?: string;
      us_phonetic?: string;
      uk_phonetic?: string;
      provider: string;
    }>;
    [key: string]: any;
  };
  error?: string;
}

export interface WorkerInfo {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  status: 'online' | 'offline';
  hostname?: string;
  platform?: string;
  completed_tasks: number;
  failed_tasks: number;
  current_task_id: string | null;
  last_heartbeat_at: string;
  created_at: string;
}

// ========== Worker API Client ==========

export class WorkerApiClient extends BaseApiClient {
  private workerId: string | null = null;

  /**
   * Register worker
   */
  async register(registration: WorkerRegistration): Promise<ApiResponse<{ worker_id: string }>> {
    const response = await this.post<{ worker_id: string }>('/api/worker/register', registration);

    if (response.success && response.data) {
      this.workerId = response.data.worker_id;
    }

    return response;
  }

  /**
   * Send heartbeat to maintain online status
   */
  async heartbeat(workerId?: string): Promise<ApiResponse<null>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<null>('/api/worker/heartbeat', { worker_id: id });
  }

  /**
   * Pull tasks with long polling
   */
  async pullTasks(
    workerId?: string,
    options: {
      limit?: number;
      timeout?: number;
    } = {},
  ): Promise<ApiResponse<{ count: number; tasks: Task[] }>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    const { limit = 5, timeout = 30 } = options;

    return this.get<{ count: number; tasks: Task[] }>(
      '/api/worker/tasks/pull',
      {
        worker_id: id,
        limit: Math.max(1, Math.min(50, limit)),
        timeout: Math.max(1, Math.min(30, timeout)),
      },
      {
        timeout: (timeout + 5) * 1000, // Add buffer to request timeout
        retries: 0, // Don't retry long polling requests
      },
    );
  }

  /**
   * Accept a task
   */
  async acceptTask(taskId: string, workerId?: string): Promise<ApiResponse<null>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<null>('/api/worker/tasks/accept', {
      task_id: taskId,
      worker_id: id,
    });
  }

  /**
   * Submit task result
   */
  async submitResult(result: TaskResult): Promise<ApiResponse<null>> {
    // Ensure worker_id is set
    if (!result.worker_id && this.workerId) {
      result.worker_id = this.workerId;
    }

    if (!result.worker_id) {
      throw new Error('Worker ID not set in result. Call register() first or provide worker_id');
    }

    return this.post<null>('/api/worker/tasks/result', result);
  }

  /**
   * Get worker list
   */
  async getWorkerList(): Promise<ApiResponse<{ count: number; workers: WorkerInfo[] }>> {
    return this.get<{ count: number; workers: WorkerInfo[] }>('/api/worker/list');
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<
    ApiResponse<{
      stats: {
        total: number;
        online: number;
        offline: number;
        idle: number;
        working: number;
      };
    }>
  > {
    return this.get('/api/worker/stats');
  }

  /**
   * Get current worker ID
   */
  getWorkerId(): string | null {
    return this.workerId;
  }

  /**
   * Set worker ID manually
   */
  setWorkerId(workerId: string): void {
    this.workerId = workerId;
  }

  /**
   * Check if worker is registered
   */
  isRegistered(): boolean {
    return this.workerId !== null;
  }
}
