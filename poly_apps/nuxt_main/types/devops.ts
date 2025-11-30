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

export interface SystemLoad {
  uptime: string;
  loadAverage: number[];
  processes: ProcessInfo[];
}

export interface ProcessInfo {
  pid: number;
  user: string;
  priority: number;
  nice: number;
  virtualMemory: number;
  residentMemory: number;
  sharedMemory: number;
  status: string;
  cpuUsage: number;
  memoryUsage: number;
  time: string;
  command: string;
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

export interface LaunchResult {
  sessionId: string;
  url?: string;
  port?: number;
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
