// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { ofetch } from 'ofetch';
import type { SystemMetrics, SystemLoad, DevEnvironment, DevTool, LaunchResult, CodeExecutionRequest, CodeExecutionResponse } from '~/types/devops';

export class DevDevOpsAPI {
  private baseUrl = '/api/devops';

  // 系统监控
  async getSystemMetrics(): Promise<SystemMetrics> {
    return await ofetch(`${this.baseUrl}/system/metrics`);
  }

  async getSystemLoad(): Promise<SystemLoad> {
    return await ofetch(`${this.baseUrl}/systemload`);
  }

  // 环境管理
  async getEnvironments(): Promise<DevEnvironment[]> {
    return await ofetch(`${this.baseUrl}/environments`);
  }

  async createEnvironment(env: Partial<DevEnvironment>): Promise<DevEnvironment> {
    return await ofetch(`${this.baseUrl}/environments`, { method: 'POST', body: env });
  }

  async startEnvironment(id: string): Promise<boolean> {
    const res = await ofetch(`${this.baseUrl}/environments/${id}/start`, { method: 'POST' });
    return res.status === 'success';
  }

  async stopEnvironment(id: string): Promise<boolean> {
    const res = await ofetch(`${this.baseUrl}/environments/${id}/stop`, { method: 'POST' });
    return res.status === 'success';
  }
  
  async deleteEnvironment(id: string): Promise<boolean> {
    const res = await ofetch(`${this.baseUrl}/environments/${id}`, { method: 'DELETE' });
    return res.success;
  }

  // 工具管理
  async getTools(category?: string): Promise<DevTool[]> {
    const params = category ? { category } : {};
    return await ofetch(`${this.baseUrl}/tools`, { params });
  }

  async launchTool(id: string, config?: any): Promise<LaunchResult> {
    return await ofetch(`${this.baseUrl}/tools/${id}/launch`, { method: 'POST', body: config });
  }

  async stopTool(id: string, sessionId: string): Promise<boolean> {
    const res = await ofetch(`${this.baseUrl}/tools/${id}/stop`, { method: 'POST', body: { sessionId } });
    return res.success;
  }

  // 代码执行
  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResponse> {
    return await ofetch(`${this.baseUrl}/execute`, { method: 'POST', body: request });
  }

  async getSupportedLanguages(): Promise<string[]> {
    return await ofetch(`${this.baseUrl}/execute/languages`);
  }
  
  // Python Env
  async getPythonStatus(): Promise<any> {
    return await ofetch('/python/status');
  }

  async setupPython(): Promise<any> {
    return await ofetch('/python/setup', { method: 'POST' });
  }
}
