/**
 * CodeMart Project Management API Service
 * Handles project CRUD, milestones, and project-related operations
 * Uses centralized type definitions from codemart-types.ts
 */

import { CodeMartApiBase, type PaginatedResponse, type PaginationParams } from './codemart-api-base';
import type { Project, Milestone, Attachment } from '../types/codemart-types';
import { ProjectStatus, ProjectComplexity } from '../types/codemart-enums';

export interface GetProjectsRequest extends PaginationParams {
  status?: ProjectStatus;
  complexity?: ProjectComplexity;
  search?: string;
}

export interface CreateProjectRequest {
  title: string;
  description: string;
  complexity: ProjectComplexity;
  budget: number;
  budget_type: 'fixed' | 'hourly';
  currency: string;
  start_date?: string;
  end_date?: string;
  skills?: string[];
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  status?: ProjectStatus;
  complexity?: ProjectComplexity;
  budget?: number;
}

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  due_date: string;
  budget: number;
  deliverables?: string[];
}

export class ProjectApi extends CodeMartApiBase {
  async getProjects(filters: GetProjectsRequest = {}): Promise<PaginatedResponse<Project>> {
    const query = this.buildQuery(filters, filters);
    const response = await this.get<PaginatedResponse<Project>>('/projects', query);
    return response;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await this.post<Project>('/projects', data);
    return response;
  }

  async getProject(projectId: number): Promise<Project> {
    const response = await this.get<Project>(`/projects/${projectId}`);
    return response;
  }

  async updateProject(projectId: number, data: UpdateProjectRequest): Promise<Project> {
    const response = await this.put<Project>(`/projects/${projectId}`, data);
    return response;
  }

  async publishProject(projectId: number): Promise<Project> {
    const response = await this.post<Project>(`/projects/${projectId}/publish`, {});
    return response;
  }

  async createMilestone(projectId: number, data: CreateMilestoneRequest): Promise<Milestone> {
    const response = await this.post<Milestone>(`/projects/${projectId}/milestones`, data);
    return response;
  }

  async uploadProjectAttachment(projectId: number, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.postFormData<Attachment>(`/projects/${projectId}/attachments`, formData);
    return response;
  }
}

export default new ProjectApi();
