
export enum Tab {
  SERVER = 'Server',
  SEMANTIC = 'Semantic',
  DATA = 'Data',
  EXTENSIONS = 'Extensions',
  AUDIO = 'Audio',
  SETTINGS = 'Settings',
  DEBUG = 'Debug'
}

export interface ExtensionItem {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface ServerState {
  status: 'running' | 'stopped';
  port: number;
  autoConnect: boolean;
}
