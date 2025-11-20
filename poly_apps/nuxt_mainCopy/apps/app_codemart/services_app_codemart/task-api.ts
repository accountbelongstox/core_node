/**
 * CodeMart Task Management API Service
 * Handles task CRUD, submissions, comments, and code reviews
 * Uses centralized type definitions from codemart-types.ts
 */

import { CodeMartApiBase, type PaginatedResponse, type PaginationParams } from './codemart-api-base';
import type { Task, TaskSubmission, TaskComment, CodeReview } from '../types/codemart-types';
import { TaskStatus, TaskPriority } from '../types/codemart-enums';

export interface GetTasksRequest extends PaginationParams {
  milestone_id?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: number;
  search?: string;
}

export interface CreateTaskRequest {
  milestone_id: number;
  title: string;
  description: string;
  priority: TaskPriority;
  assigned_to?: number;
  due_date?: string;
  deliverables?: string[];
  budget_allocation?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: number;
  due_date?: string;
  deliverables?: string[];
  budget_allocation?: number;
}

export interface SubmitTaskRequest {
  submission_note?: string;
  files?: string[];
}

export interface AddCommentRequest {
  comment: string;
  mentions?: number[];
}

export interface ReviewSubmissionRequest {
  status: 'approved' | 'needs_revision' | 'rejected';
  review_notes: string;
  rating?: number;
  line_comments?: Record<string, string>;
}

export class TaskApi extends CodeMartApiBase {
  async getTasks(filtersOrProjectId?: GetTasksRequest | string): Promise<PaginatedResponse<Task>> {
    let filters: GetTasksRequest = {};

    if (typeof filtersOrProjectId === 'string') {
      // If a project ID string is passed, treat it as a filter
      filters = { search: filtersOrProjectId };
    } else if (filtersOrProjectId) {
      filters = filtersOrProjectId;
    }

    const query = this.buildQuery(filters, filters);
    const response = await this.get<PaginatedResponse<Task>>('/tasks', query);
    return response;
  }

  async createTask(data: CreateTaskRequest | any): Promise<Task> {
    const response = await this.post<Task>('/tasks', data);
    return response;
  }

  async getTask(taskId: number | string): Promise<Task> {
    const response = await this.get<Task>(`/tasks/${taskId}`);
    return response;
  }

  async updateTask(taskId: number | string, data: UpdateTaskRequest | any): Promise<Task> {
    const response = await this.put<Task>(`/tasks/${taskId}`, data);
    return response;
  }

  async submitTask(taskId: number | string, dataOrDeliverables: SubmitTaskRequest | string): Promise<TaskSubmission> {
    let data: SubmitTaskRequest;

    if (typeof dataOrDeliverables === 'string') {
      data = { submission_note: dataOrDeliverables };
    } else {
      data = dataOrDeliverables;
    }

    const response = await this.post<TaskSubmission>(`/tasks/${taskId}/submit`, data);
    return response;
  }

  async addComment(taskId: number, data: AddCommentRequest): Promise<TaskComment> {
    const response = await this.post<TaskComment>(`/tasks/${taskId}/comments`, data);
    return response;
  }

  async reviewSubmission(submissionId: number, data: ReviewSubmissionRequest): Promise<CodeReview> {
    const response = await this.post<CodeReview>(`/submissions/${submissionId}/review`, data);
    return response;
  }

  async deleteTask(taskId: number | string): Promise<void> {
    const response = await this.delete<void>(`/tasks/${taskId}`);
    return response;
  }

  async acceptTask(taskId: number | string): Promise<Task> {
    const response = await this.post<Task>(`/tasks/${taskId}/accept`, {});
    return response;
  }

  async rejectTask(taskId: number | string, reason: string): Promise<Task> {
    const response = await this.post<Task>(`/tasks/${taskId}/reject`, { reason });
    return response;
  }
}

export default new TaskApi();
