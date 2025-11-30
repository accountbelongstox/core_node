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

// DevOps Integration API Service for Dev App
// This service handles communication with the NCore DevOps backend

// Base API URL for DevOps backend
const DEVOPS_API_BASE = 'http://localhost:3000/api/devops';

// Import types from the exchange document
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
  systemRequirements: {
    minMemory: number;
    minCpu: number;
    supportedOS: string[];
  };
}

export interface DevEnvironment {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'cloud' | 'container' | 'vm';
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  tools: string[];
  ports: number[];
  createdAt: string;
  lastAccessed: string;
  configuration: {
    language: string;
    framework: string;
    runtime: string;
    packages: string[];
  };
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    processes: Array<{
      pid: number;
      name: string;
      cpu: number;
      memory: number;
    }>;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
  uptime: string;
}

export interface CodeExecutionRequest {
  code: string;
  language: string;
  environment?: string;
  timeout?: number;
  memoryLimit?: number;
  inputData?: string;
}

export interface CodeExecutionResponse {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  exitCode?: number;
}

// DevOps Integration API Service
export class DevOpsIntegrationAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = DEVOPS_API_BASE;
  }

  // System Monitoring APIs
  async getSystemMetrics(): Promise<SystemMetrics | null> {
    try {
      const response = await $fetch<{success: boolean; data: SystemMetrics}>(`${this.baseUrl}/system/metrics`, {
        method: 'GET'
      });
      
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      return null;
    }
  }

  // Development Tools APIs
  async getDevTools(category?: string): Promise<DevTool[]> {
    try {
      const params = category ? `?category=${category}` : '';
      const response = await $fetch<{success: boolean; data: DevTool[]}>(`${this.baseUrl}/tools${params}`, {
        method: 'GET'
      });
      
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch development tools:', error);
      return [];
    }
  }

  async getDevTool(id: string): Promise<DevTool | null> {
    try {
      const response = await $fetch<{success: boolean; data: DevTool}>(`${this.baseUrl}/tools/${id}`, {
        method: 'GET'
      });
      
      return response.success ? response.data : null;
    } catch (error) {
      console.error(`Failed to fetch development tool ${id}:`, error);
      return null;
    }
  }

  async launchDevTool(id: string, config?: Record<string, any>): Promise<{
    success: boolean;
    sessionId?: string;
    url?: string;
    port?: number;
    message: string;
  }> {
    try {
      const response = await $fetch<any>(`${this.baseUrl}/tools/${id}/launch`, {
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
          port: response.data.port,
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

  async stopDevTool(id: string, sessionId: string): Promise<boolean> {
    try {
      const response = await $fetch<{success: boolean}>(`${this.baseUrl}/tools/${id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { sessionId }
      });
      
      return response.success;
    } catch (error) {
      console.error(`Failed to stop development tool ${id}:`, error);
      return false;
    }
  }

  async getDevToolStats(): Promise<any> {
    try {
      const response = await $fetch<any>(`${this.baseUrl}/tools/stats`, {
        method: 'GET'
      });
      
      if (response.success) {
        return response.data;
      }
      return {
        totalTools: 0,
        activeTools: 0,
        totalSessions: 0,
        averageSessionTime: 0,
        popularTools: [],
        activeSessions: 0
      };
    } catch (error) {
      console.error('Failed to fetch development tool statistics:', error);
      return {
        totalTools: 0,
        activeTools: 0,
        totalSessions: 0,
        averageSessionTime: 0,
        popularTools: [],
        activeSessions: 0
      };
    }
  }

  // Development Environments APIs
  async getDevEnvironments(type?: string, status?: string): Promise<DevEnvironment[]> {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      
      const queryString = params.toString();
      const url = `${this.baseUrl}/environments${queryString ? `?${queryString}` : ''}`;
      
      const response = await $fetch<{success: boolean; data: DevEnvironment[]}>(url, {
        method: 'GET'
      });
      
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch development environments:', error);
      return [];
    }
  }

  async createDevEnvironment(environment: Partial<DevEnvironment>): Promise<DevEnvironment | null> {
    try {
      const response = await $fetch<{success: boolean; data: DevEnvironment}>(`${this.baseUrl}/environments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: environment
      });
      
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to create development environment:', error);
      return null;
    }
  }

  async startDevEnvironment(id: string): Promise<boolean> {
    try {
      const response = await $fetch<{success: boolean}>(`${this.baseUrl}/environments/${id}/start`, {
        method: 'POST'
      });
      
      return response.success;
    } catch (error) {
      console.error(`Failed to start development environment ${id}:`, error);
      return false;
    }
  }

  async stopDevEnvironment(id: string): Promise<boolean> {
    try {
      const response = await $fetch<{success: boolean}>(`${this.baseUrl}/environments/${id}/stop`, {
        method: 'POST'
      });
      
      return response.success;
    } catch (error) {
      console.error(`Failed to stop development environment ${id}:`, error);
      return false;
    }
  }

  // Code Execution APIs
  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResponse> {
    try {
      const response = await $fetch<{success: boolean; data: CodeExecutionResponse}>(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: request
      });
      
      if (response.success) {
        return response.data;
      } else {
        return {
          success: false,
          error: 'Execution failed',
          executionTime: 0,
          memoryUsed: 0,
          exitCode: -1
        };
      }
    } catch (error) {
      console.error('Failed to execute code:', error);
      return {
        success: false,
        error: 'Execution failed',
        executionTime: 0,
        memoryUsed: 0,
        exitCode: -1
      };
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    try {
      const response = await $fetch<{success: boolean; data: Array<{name: string}>}>(`${this.baseUrl}/execute/languages`, {
        method: 'GET'
      });
      
      if (response.success) {
        return response.data.map(lang => lang.name);
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch supported languages:', error);
      return [];
    }
  }
  
  // Python Env
  async getPythonStatus(): Promise<any> {
    try {
        const response = await $fetch<any>(`http://localhost:3000/python/status`);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('Failed to fetch python status:', error);
        return null;
    }
  }

  async setupPython(): Promise<any> {
    try {
        const response = await $fetch<any>(`http://localhost:3000/python/setup`, { method: 'POST' });
        return response;
    } catch (error) {
        console.error('Failed to setup python:', error);
        return null;
    }
  }
}

// Export singleton instance
export const devOpsIntegrationAPI = new DevOpsIntegrationAPI();
export default devOpsIntegrationAPI;
