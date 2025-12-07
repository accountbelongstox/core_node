import { 
  DashboardOverview, 
  RealtimeMetrics, 
  SystemStatus, 
  LocalCapabilities, 
  UploadTask,
  SystemConfig,
  LocalProcessingConfig,
  RemoteServer,
  LogEntry,
  UploadHistoryItem,
  UploadServer,
  PerformanceStats,
  UsageTrends,
  ResourceStats
} from '../types';

// Mock Data Generators

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        system: {
          status: 'running',
          uptime: 12450,
          version: '2.1.0',
          pid: 4521,
        },
        resources: {
          cpu_usage: 45.2,
          memory_usage: 4096,
          disk_usage: { total: 512, used: 210, free: 302 },
        },
        today_stats: {
          processed_tasks: 1240,
          uploaded_files: 1235,
          failed_tasks: 5,
          success_rate: 99.6,
        },
      });
    }, 500);
  });
};

export const getRealtimeMetrics = async (count = 10): Promise<RealtimeMetrics[]> => {
  const data: RealtimeMetrics[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const time = new Date(now.getTime() - (count - 1 - i) * 60000); // Past minutes
    data.push({
      timestamp: time.toISOString(),
      cpu_usage: 30 + Math.random() * 40,
      memory_usage: 2048 + Math.random() * 1024,
      network_upload: Math.random() * 500,
      tasks_per_minute: Math.floor(Math.random() * 20),
    });
  }
  return Promise.resolve(data);
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        system: {
          status: 'running',
          uptime: 12450,
          version: '2.1.0',
          pid: 4521,
          cpu_usage: 45,
          memory_usage: 4096,
          disk_usage: { total: 512, used: 210, free: 302 },
        },
        services: {
          rpc_v2: 'running',
          heartbeat: 'running',
          ui: 'running',
          tray: 'running',
          local_processor: 'starting',
        },
        local_processing: {
          enabled: true,
          capabilities: {
            screenshot: true,
            ocr: true,
            audio_transcribe: true,
            video_process: false,
          },
          statistics: {
            total_processed: 15420,
            today_processed: 1240,
            failed: 12,
            average_time: 1.2,
          },
        },
      });
    }, 600);
  });
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
  return Promise.resolve({
    debug: false,
    log_level: 'INFO',
    max_connections: 1000,
    auto_start: true
  });
};

export const updateSystemConfig = async (config: SystemConfig): Promise<boolean> => {
  console.log("Updated system config:", config);
  return new Promise(resolve => setTimeout(() => resolve(true), 500));
};

export const getLocalCapabilities = async (): Promise<LocalCapabilities> => {
  return Promise.resolve({
    hardware: {
      cpu: { model: 'AMD Ryzen 9 5950X', cores: 16, threads: 32, available: true },
      gpu: { model: 'NVIDIA GeForce RTX 4090', memory: 24576, available: true, cuda_version: '12.1' },
      memory: { total: 65536, available: 32450 },
    },
    capabilities: {
      screenshot: { available: true, supported_formats: ['png', 'jpg', 'bmp'] },
      ocr: { available: true, engines: ['PaddleOCR', 'Tesseract'] },
      audio: { available: true, engines: ['Whisper', 'Vosk'] },
      video: { available: false, supported_formats: [] },
    },
  });
};

export const getLocalConfig = async (): Promise<LocalProcessingConfig> => {
  return Promise.resolve({
    screenshot: {
      enabled: true,
      format: 'png',
      auto_ocr: true
    },
    ocr: {
      enabled: true,
      engine: 'PaddleOCR',
      language: 'eng+chi_sim',
      gpu_enabled: true
    },
    audio: {
      enabled: true,
      model: 'medium',
      device: 'cuda'
    }
  });
};

export const updateLocalConfig = async (config: LocalProcessingConfig): Promise<boolean> => {
   console.log("Updated local config:", config);
   return new Promise(resolve => setTimeout(() => resolve(true), 500));
};

export const getUploadTasks = async (): Promise<UploadTask[]> => {
  return Promise.resolve([
    {
      upload_id: 'up_1001',
      result_type: 'ocr_json',
      status: 'uploading',
      progress: 45,
      speed: 2.5,
      created_at: new Date().toISOString(),
    },
    {
      upload_id: 'up_1002',
      result_type: 'audio_transcript',
      status: 'completed',
      progress: 100,
      speed: 0,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      upload_id: 'up_1003',
      result_type: 'screenshot',
      status: 'failed',
      progress: 20,
      speed: 0,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);
};

export const getUploadHistory = async (): Promise<UploadHistoryItem[]> => {
    return Promise.resolve([
        { upload_id: 'up_999', result_type: 'ocr', status: 'completed', uploaded_at: '2023-12-01T10:00:00Z', file_count: 5, total_size: 102400, server_url: 'https://api.example.com' },
        { upload_id: 'up_998', result_type: 'audio', status: 'completed', uploaded_at: '2023-12-01T09:30:00Z', file_count: 1, total_size: 5024000, server_url: 'https://api.example.com' },
    ]);
};

export const getUploadServers = async (): Promise<UploadServer[]> => {
    return Promise.resolve([
        { name: 'Main Server', url: 'https://api.main.com', status: 'online', enabled: true, priority: 1 },
        { name: 'Backup Server', url: 'https://api.backup.com', status: 'offline', enabled: true, priority: 2 },
    ]);
};

export const getRemoteServers = async (): Promise<RemoteServer[]> => {
    return Promise.resolve([
        { id: 'srv_1', name: 'Tokyo Node', url: 'https://jp-node.pycore.net', type: 'relay', status: 'online', latency: 45, enabled: true, last_check: new Date().toISOString() },
        { id: 'srv_2', name: 'US East Node', url: 'https://us-east.pycore.net', type: 'storage', status: 'online', latency: 120, enabled: true, last_check: new Date().toISOString() },
        { id: 'srv_3', name: 'Europe Node', url: 'https://eu-node.pycore.net', type: 'relay', status: 'offline', latency: 0, enabled: false, last_check: new Date(Date.now() - 86400000).toISOString() },
    ]);
};

export const getLogs = async (): Promise<LogEntry[]> => {
    const logs: LogEntry[] = [];
    const levels = ['INFO', 'DEBUG', 'WARNING', 'ERROR'];
    const cats = ['system', 'network', 'local_proc', 'upload'];
    for(let i=0; i<20; i++) {
        logs.push({
            id: `log_${i}`,
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            level: levels[Math.floor(Math.random() * levels.length)] as any,
            category: cats[Math.floor(Math.random() * cats.length)],
            message: `Sample log message entry number ${i} indicating system activity or status change.`
        });
    }
    return Promise.resolve(logs);
};

export const getPerformanceStats = async (): Promise<PerformanceStats> => {
    const count = 24;
    const cpu: {timestamp: string, value: number}[] = [];
    const mem: {timestamp: string, value: number}[] = [];
    const now = new Date();
    
    for(let i=0; i<count; i++) {
        const t = new Date(now.getTime() - (count - 1 - i) * 3600000).toISOString();
        cpu.push({ timestamp: t, value: 20 + Math.random() * 60 });
        mem.push({ timestamp: t, value: 40 + Math.random() * 30 });
    }

    return Promise.resolve({
        period: '24h',
        cpu_history: cpu,
        memory_history: mem
    });
};

export const getUsageTrends = async (): Promise<UsageTrends> => {
    const days = 7;
    const data = [];
    const now = new Date();

    for(let i=0; i<days; i++) {
        const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
        data.push({
            date: d.toLocaleDateString(),
            tasks: Math.floor(500 + Math.random() * 1000),
            uploads: Math.floor(400 + Math.random() * 800)
        });
    }

    return Promise.resolve({
        period: '7d',
        data
    });
};

export const getResourceStats = async (): Promise<ResourceStats> => {
    return Promise.resolve({
        disk: [
            { mount: '/', total: 512, used: 320, free: 192 },
            { mount: '/data', total: 2048, used: 1024, free: 1024 }
        ],
        network: [
            { interface: 'eth0', upload_total: 15420, download_total: 42100 },
            { interface: 'wlan0', upload_total: 210, download_total: 540 }
        ]
    });
};