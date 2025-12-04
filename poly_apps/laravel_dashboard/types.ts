
import { LucideIcon } from "lucide-react";

export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark';
export type LayoutMode = 'vertical' | 'horizontal';

export enum ViewType {
  DASHBOARD = 'dashboard',
  MEDIA_BROWSER = 'media',
  CODE_BROWSER = 'code',
  TOOLS = 'tools',
  API_TESTER = 'api',
  SETTINGS = 'settings'
}

export interface NavItem {
  id: ViewType;
  icon: LucideIcon;
  labelKey: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'video' | 'audio' | 'image' | 'code' | 'text' | 'unknown';
  size?: string;
  date?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

export type ToolStatus = 'available' | 'todo' | 'beta';

export interface ToolItem {
  id: string;
  name: string;
  description?: string;
  status: ToolStatus;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  tools: ToolItem[];
}

export interface ApiParam {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'file' | 'array' | 'numeric' | 'email';
  required: boolean;
  description?: string;
  options?: string[]; // For enums
  default?: any;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
  path: string;
  description: string;
  section?: string; // e.g. "System", "Auth", "ITTools - Crypto"
  params?: ApiParam[];
}

export interface AudioSegment {
  id: string;
  text: string;
  duration: number; // in seconds
  src?: string; // URL to audio file (optional for mock)
}

export interface TaskItem {
  id: string;
  title: string;
  size: string;
  date: string;
  status: 'idle' | 'queued' | 'processing' | 'done';
  promptText: string;
  audioSegments: AudioSegment[];
}

// Tool System Types
export type ToolExecutionMode = 'local' | 'cloud';

export interface ToolConfig {
  toolId: string;
  apiUrl: string;
  apiKey?: string;
  mode: ToolExecutionMode;
}

// Universal Tool UI Schema
export type InputType = 'text' | 'number' | 'textarea' | 'select' | 'file' | 'color' | 'checkbox' | 'datetime';

export interface ToolInput {
  id: string;
  label: string;
  type: InputType;
  placeholder?: string;
  defaultValue?: any;
  options?: { label: string; value: string }[]; // For select
  accept?: string; // For file
}

export interface ToolAction {
  id: string;
  label: string;
  icon?: any; // LucideIcon name or reference logic
  apiPath?: string;
}

export interface ToolOutput {
  id: string;
  label: string;
  type: 'text' | 'json' | 'image-preview' | 'download' | 'html' | 'markdown';
}

export interface ToolUISchema {
  id: string;
  title: string;
  description: string;
  inputs: ToolInput[];
  actions: ToolAction[];
  outputs: ToolOutput[];
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    statusCode?: number;
    latency?: number;
    dataSource?: 'cloud' | 'mock';
}

// --- Domain Models ---

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Screenshot {
  id: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  description?: string;
  created_at: string;
}

export interface ClipboardData {
    text: string;
    files: Array<{
        id: string;
        original_name: string;
        size: number;
    }>;
    updated_at: string;
}
