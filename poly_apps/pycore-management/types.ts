// System Types
export type ServiceStatus = 'running' | 'stopped' | 'error' | 'starting';
export type TaskStatus = 'pending' | 'uploading' | 'completed' | 'failed';
export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark' | 'auto';

export interface DashboardOverview {
  system: {
    status: 'running' | 'stopped' | 'error';
    uptime: number; // seconds
    version: string;
    pid: number;
  };
  resources: {
    cpu_usage: number; // percentage
    memory_usage: number; // MB
    disk_usage: {
      total: number; // GB
      used: number;
      free: number;
    };
  };
  today_stats: {
    processed_tasks: number;
    uploaded_files: number;
    failed_tasks: number;
    success_rate: number; // percentage
  };
}

export interface RealtimeMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  network_upload: number;
  tasks_per_minute: number;
}

export interface SystemStatus {
  system: DashboardOverview['system'] & {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: DashboardOverview['resources']['disk_usage'];
  };
  services: {
    rpc_v2: ServiceStatus;
    heartbeat: ServiceStatus;
    ui: ServiceStatus;
    tray: ServiceStatus;
    local_processor: ServiceStatus;
  };
  local_processing: {
    enabled: boolean;
    capabilities: {
      screenshot: boolean;
      ocr: boolean;
      audio_transcribe: boolean;
      video_process: boolean;
    };
    statistics: {
      total_processed: number;
      today_processed: number;
      failed: number;
      average_time: number;
    };
  };
}

export interface SystemConfig {
  debug: boolean;
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  max_connections: number;
  auto_start: boolean;
}

// Local Processing Types
export interface LocalCapabilities {
  hardware: {
    cpu: { model: string; cores: number; threads: number; available: boolean };
    gpu: { model: string; memory: number; available: boolean; cuda_version: string };
    memory: { total: number; available: number };
  };
  capabilities: {
    screenshot: { available: boolean; supported_formats: string[] };
    ocr: { available: boolean; engines: string[] };
    audio: { available: boolean; engines: string[] };
    video: { available: boolean; supported_formats: string[] };
  };
}

export interface LocalProcessingConfig {
  screenshot: {
    enabled: boolean;
    format: 'png' | 'jpg';
    auto_ocr: boolean;
  };
  ocr: {
    enabled: boolean;
    engine: string;
    language: string;
    gpu_enabled: boolean;
  };
  audio: {
    enabled: boolean;
    model: string;
    device: 'cpu' | 'cuda';
  };
}

export interface LocalProcessingStats {
  period: string;
  summary: {
    total_tasks: number;
    completed: number;
    failed: number;
    average_time: number; // seconds
    total_data_processed: number; // MB
  };
  by_type: {
    name: string;
    count: number;
    success_rate: number;
  }[];
  timeline: {
    date: string;
    tasks: number;
    success: number;
    failed: number;
  }[];
}

export interface TestRequest {
  test_type: 'screenshot' | 'ocr' | 'audio' | 'video';
  test_data?: string;
}

export interface TestResponse {
  success: boolean;
  test_type: string;
  result: any;
  execution_time: number;
  hardware_used: {
    cpu: boolean;
    gpu: boolean;
  };
  error?: string;
}

// --- Specific Tool Request/Response Types ---

export interface ScreenshotRequest {
  mode: 'fullscreen' | 'window' | 'region';
  format?: 'png' | 'jpg';
  auto_ocr: boolean;
  auto_upload: boolean;
}

export interface ScreenshotResponse {
  success: boolean;
  file_path: string;
  image_data?: string; // base64
  ocr_text?: string;
  execution_time: number;
}

export interface OCRRequest {
  image_data: string; // base64
  engine: string;
  language?: string;
}

export interface OCRResponse {
  success: boolean;
  text: string;
  confidence: number;
  blocks: { text: string; box: number[] }[];
  execution_time: number;
}

export interface AudioTranscribeRequest {
  file_name: string;
  // In real app, we might upload file via FormData, but for mock/type simplicity:
  model: string;
  generate_subtitle: boolean;
}

export interface AudioTranscribeResponse {
  success: boolean;
  text: string;
  language: string;
  duration: number;
  segments: { start: number; end: number; text: string }[];
  execution_time: number;
}

export interface VideoProcessRequest {
  file_name: string;
  extract_audio: boolean;
  generate_subtitle: boolean;
}

export interface VideoProcessResponse {
  success: boolean;
  metadata: { duration: number; resolution: string; codec: string };
  audio_path?: string;
  subtitle_path?: string;
  execution_time: number;
}

export interface FileAnalyzeRequest {
  file_name: string;
  file_type: string;
  extract_text: boolean;
  extract_metadata: boolean;
}

export interface FileAnalyzeResponse {
  success: boolean;
  metadata: { author?: string; pages?: number; created?: string };
  text_preview?: string;
  execution_time: number;
}

// Upload Types
export interface UploadTask {
  upload_id: string;
  result_type: string;
  status: TaskStatus;
  progress: number;
  speed: number; // MB/s
  created_at: string;
}

export interface UploadHistoryItem {
  upload_id: string;
  result_type: string;
  status: string;
  uploaded_at: string;
  file_count: number;
  total_size: number; // bytes
  server_url: string;
}

export interface UploadServer {
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  enabled: boolean;
  priority: number;
}

// Remote Server Types
export interface RemoteServer {
  id: string;
  name: string;
  url: string;
  type: string;
  status: 'online' | 'offline' | 'unknown';
  latency: number;
  enabled: boolean;
  last_check: string;
}

// Log Types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  message: string;
}

// Statistics Types
export interface PerformanceStats {
  period: string;
  cpu_history: { timestamp: string; value: number }[];
  memory_history: { timestamp: string; value: number }[];
}

export interface UsageTrends {
  period: string;
  data: { date: string; tasks: number; uploads: number }[];
}

export interface ResourceStats {
  disk: { total: number; used: number; free: number; mount: string }[];
  network: { interface: string; upload_total: number; download_total: number }[];
}

// App Types
export interface AppSettings {
  language: Language;
  theme: Theme;
  notifications: boolean;
  refreshRate: number;
}

// Menu Types
export type ViewState = 
  | 'dashboard' 
  | 'system_status' 
  | 'system_config'
  | 'local_capabilities'
  | 'local_config'
  | 'local_stats'
  | 'local_test'
  | 'upload_tasks'
  | 'remote_servers'
  | 'logs'
  | 'tools'
  | 'statistics'
  | 'settings';
