// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { getAppEntryConfig } from '@/app-entry';

// Project interface for CodeMart
export interface CodeMartProject {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
  stats: {
    downloads: number;
    stars: number;
    forks: number;
    views: number;
  };
  repository: {
    url: string;
    branch: string;
    lastCommit: string;
  };
  license: string;
  status: 'active' | 'inactive' | 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
  featured: boolean;
}

// CodeMart Projects API Service
export class CodeMartProjectsAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('codemart');
    this.baseUrl = `${appConfig.api.baseUrl}/projects`;
    this.namespace = appConfig.api.namespace;
  }

  // Get all projects with pagination
  async getProjects(page: number = 1, limit: number = 20, filters?: {
    category?: string;
    language?: string;
    priceRange?: { min: number; max: number };
    featured?: boolean;
  }): Promise<{
    projects: CodeMartProject[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (filters?.category) params.append('category', filters.category);
      if (filters?.language) params.append('language', filters.language);
      if (filters?.priceRange) {
        params.append('minPrice', filters.priceRange.min.toString());
        params.append('maxPrice', filters.priceRange.max.toString());
      }
      if (filters?.featured !== undefined) params.append('featured', filters.featured.toString());

      const response = await $fetch<{
        projects: CodeMartProject[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch CodeMart projects:', error);
      return { projects: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  // Get project by ID
  async getProject(id: string): Promise<CodeMartProject | null> {
    try {
      const response = await $fetch<CodeMartProject>(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to fetch CodeMart project ${id}:`, error);
      return null;
    }
  }

  // Search projects
  async searchProjects(query: string, filters?: {
    category?: string;
    language?: string;
    priceRange?: { min: number; max: number };
  }): Promise<CodeMartProject[]> {
    try {
      const params = new URLSearchParams({ q: query });
      
      if (filters?.category) params.append('category', filters.category);
      if (filters?.language) params.append('language', filters.language);
      if (filters?.priceRange) {
        params.append('minPrice', filters.priceRange.min.toString());
        params.append('maxPrice', filters.priceRange.max.toString());
      }

      const response = await $fetch<CodeMartProject[]>(`${this.baseUrl}/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to search CodeMart projects:', error);
      return [];
    }
  }

  // Get featured projects
  async getFeaturedProjects(limit: number = 10): Promise<CodeMartProject[]> {
    try {
      const response = await $fetch<CodeMartProject[]>(`${this.baseUrl}/featured?limit=${limit}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch featured CodeMart projects:', error);
      return [];
    }
  }

  // Get project categories
  async getCategories(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    count: number;
  }>> {
    try {
      const response = await $fetch<Array<{
        id: string;
        name: string;
        description: string;
        count: number;
      }>>(`${this.baseUrl}/categories`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch CodeMart categories:', error);
      return [];
    }
  }

  // Get marketplace statistics
  async getMarketplaceStats(): Promise<{
    totalProjects: number;
    totalAuthors: number;
    totalDownloads: number;
    totalRevenue: number;
    topCategories: Array<{ name: string; count: number }>;
    topLanguages: Array<{ name: string; count: number }>;
  }> {
    try {
      const response = await $fetch<{
        totalProjects: number;
        totalAuthors: number;
        totalDownloads: number;
        totalRevenue: number;
        topCategories: Array<{ name: string; count: number }>;
        topLanguages: Array<{ name: string; count: number }>;
      }>(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch CodeMart marketplace statistics:', error);
      return {
        totalProjects: 0,
        totalAuthors: 0,
        totalDownloads: 0,
        totalRevenue: 0,
        topCategories: [],
        topLanguages: []
      };
    }
  }

  // Purchase project
  async purchaseProject(projectId: string, paymentMethod: string): Promise<{
    success: boolean;
    transactionId?: string;
    downloadUrl?: string;
    message: string;
  }> {
    try {
      const response = await $fetch<{
        success: boolean;
        transactionId?: string;
        downloadUrl?: string;
        message: string;
      }>(`${this.baseUrl}/${projectId}/purchase`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: { paymentMethod }
      });
      return response;
    } catch (error) {
      console.error(`Failed to purchase CodeMart project ${projectId}:`, error);
      return { success: false, message: 'Purchase failed' };
    }
  }
}

// Export singleton instance
export const codeMartProjectsAPI = new CodeMartProjectsAPI();
export default codeMartProjectsAPI;
