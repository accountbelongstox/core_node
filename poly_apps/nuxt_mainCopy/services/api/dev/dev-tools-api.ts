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

// Base API URL for DevOps backend
const DEVOPS_API_BASE = 'http://localhost:3000/api';

// Development Tool interface
export interface DevTool {
  id: string;
  name: string;
  description: string;
  category: 'editor' | 'debugger' | 'testing' | 'deployment' | 'monitoring' | 'utility';
  version: string;
  status: 'active' | 'inactive' | 'maintenance';
  config: Record<string, any>;
  lastUsed: string;
  usage: {
    totalSessions: number;
    totalTime: number;
    averageSessionTime: number;
  };
}

// Development Environment interface
export interface DevEnvironment {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'cloud' | 'container';
  status: 'running' | 'stopped' | 'error';
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  tools: string[];
  createdAt: string;
  lastAccessed: string;
}

// Dev Tools API Service
export class DevToolsAPI {
  private baseUrl: string;
  private namespace: string;
  private devOpsBaseUrl: string;

  constructor() {
    const appConfig = getAppEntryConfig('dev');
    this.baseUrl = `${appConfig.api.baseUrl}/tools`;
    this.namespace = appConfig.api.namespace;
    this.devOpsBaseUrl = DEVOPS_API_BASE;
  }

  // Get all development tools
  async getTools(category?: string): Promise<DevTool[]> {
    try {
      const params = category ? `?category=${category}` : '';
      const response = await $fetch<{success: boolean; data: DevTool[]}>(`${this.devOpsBaseUrl}/dev/tools${params}`, {
        method: 'GET'
      });

      if (response.success) {
        return response.data;
      } else {
        console.error('DevOps API error:', response);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch development tools:', error);
      return [];
    }
  }

  // Get tool by ID
  async getTool(id: string): Promise<DevTool | null> {
    try {
      const response = await $fetch<{success: boolean; data: DevTool}>(`${this.devOpsBaseUrl}/dev/tools/${id}`, {
        method: 'GET'
      });

      if (response.success) {
        return response.data;
      } else {
        console.error('DevOps API error:', response);
        return null;
      }
    } catch (error) {
      console.error(`Failed to fetch development tool ${id}:`, error);
      return null;
    }
  }

  // Launch development tool
  async launchTool(id: string, config?: Record<string, any>): Promise<{
    success: boolean;
    sessionId?: string;
    url?: string;
    message: string;
  }> {
    try {
      const response = await $fetch<{
        success: boolean;
        data: {
          sessionId?: string;
          url?: string;
          port?: number;
        };
        message: string;
      }>(`${this.devOpsBaseUrl}/dev/tools/${id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { config }
      });

      if (response.success) {
        return {
          success: true,
          sessionId: response.data.sessionId,
          url: response.data.url,
          message: response.message
        };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error(`Failed to launch development tool ${id}:`, error);
      return { success: false, message: 'Failed to launch tool' };
    }
  }

  // Stop development tool
  async stopTool(id: string, sessionId: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/${id}/stop`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: { sessionId }
      });
      return true;
    } catch (error) {
      console.error(`Failed to stop development tool ${id}:`, error);
      return false;
    }
  }

  // Get development environments
  async getEnvironments(): Promise<DevEnvironment[]> {
    try {
      const response = await $fetch<DevEnvironment[]>(`${this.baseUrl.replace('/tools', '/environments')}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch development environments:', error);
      return [];
    }
  }

  // Create development environment
  async createEnvironment(environment: Partial<DevEnvironment>): Promise<DevEnvironment | null> {
    try {
      const response = await $fetch<DevEnvironment>(`${this.baseUrl.replace('/tools', '/environments')}`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: environment
      });
      return response;
    } catch (error) {
      console.error('Failed to create development environment:', error);
      return null;
    }
  }

  // Start development environment
  async startEnvironment(id: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl.replace('/tools', '/environments')}/${id}/start`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return true;
    } catch (error) {
      console.error(`Failed to start development environment ${id}:`, error);
      return false;
    }
  }

  // Stop development environment
  async stopEnvironment(id: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl.replace('/tools', '/environments')}/${id}/stop`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return true;
    } catch (error) {
      console.error(`Failed to stop development environment ${id}:`, error);
      return false;
    }
  }

  // Get development statistics
  async getDevStatistics(): Promise<{
    totalTools: number;
    activeTools: number;
    totalEnvironments: number;
    runningEnvironments: number;
    totalSessions: number;
    averageSessionTime: number;
    popularTools: Array<{ name: string; usage: number }>;
  }> {
    try {
      const response = await $fetch<{
        totalTools: number;
        activeTools: number;
        totalEnvironments: number;
        runningEnvironments: number;
        totalSessions: number;
        averageSessionTime: number;
        popularTools: Array<{ name: string; usage: number }>;
      }>(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch development statistics:', error);
      return {
        totalTools: 0,
        activeTools: 0,
        totalEnvironments: 0,
        runningEnvironments: 0,
        totalSessions: 0,
        averageSessionTime: 0,
        popularTools: []
      };
    }
  }

  // Execute code snippet
  async executeCode(code: string, language: string, environment?: string): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    executionTime: number;
  }> {
    try {
      const response = await $fetch<{
        success: boolean;
        output?: string;
        error?: string;
        executionTime: number;
      }>(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: { code, language, environment }
      });
      return response;
    } catch (error) {
      console.error('Failed to execute code:', error);
      return { success: false, error: 'Execution failed', executionTime: 0 };
    }
  }
}

// Export singleton instance
export const devToolsAPI = new DevToolsAPI();
export default devToolsAPI;
