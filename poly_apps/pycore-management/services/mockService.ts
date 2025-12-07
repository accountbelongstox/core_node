
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
  ResourceStats,
  LocalProcessingStats,
  TestRequest,
  TestResponse,
  ScreenshotRequest,
  ScreenshotResponse,
  OCRRequest,
  OCRResponse,
  AudioTranscribeRequest,
  AudioTranscribeResponse,
  VideoProcessRequest,
  VideoProcessResponse,
  FileAnalyzeRequest,
  FileAnalyzeResponse
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

export const getLocalProcessingStats = async (): Promise<LocalProcessingStats> => {
    const timeline = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() - (6 - i) * 86400000);
        timeline.push({
            date: d.toLocaleDateString(),
            tasks: Math.floor(Math.random() * 500),
            success: Math.floor(Math.random() * 450),
            failed: Math.floor(Math.random() * 50),
        });
    }

    return Promise.resolve({
        period: '7d',
        summary: {
            total_tasks: 12500,
            completed: 12450,
            failed: 50,
            average_time: 1.45,
            total_data_processed: 4500,
        },
        by_type: [
            { name: 'Screenshot', count: 5000, success_rate: 99.8 },
            { name: 'OCR', count: 4500, success_rate: 98.5 },
            { name: 'Audio', count: 3000, success_rate: 99.2 },
        ],
        timeline,
    });
};

export const runLocalTest = async (req: TestRequest): Promise<TestResponse> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                test_type: req.test_type,
                result: {
                    message: "Test completed successfully",
                    details: "Simulated output data...",
                    score: 0.98
                },
                execution_time: 0.85,
                hardware_used: {
                    cpu: true,
                    gpu: req.test_type === 'ocr' || req.test_type === 'audio'
                }
            });
        }, 1500);
    });
};

// --- Tool Implementations ---

export const captureScreenshot = async (req: ScreenshotRequest): Promise<ScreenshotResponse> => {
    return new Promise(resolve => setTimeout(() => resolve({
        success: true,
        file_path: `/tmp/screenshot_${Date.now()}.png`,
        image_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // dummy dot
        ocr_text: req.auto_ocr ? "Detected Text: Pycore Management System v2.0" : undefined,
        execution_time: 0.5
    }), 1000));
};

export const performOCR = async (req: OCRRequest): Promise<OCRResponse> => {
    return new Promise(resolve => setTimeout(() => resolve({
        success: true,
        text: "This is a simulated OCR result extracted from the uploaded image.\nPycore Engine v2.0\nStatus: Active",
        confidence: 0.98,
        blocks: [{ text: "Pycore Engine", box: [0,0,100,20] }],
        execution_time: 1.2
    }), 1500));
};

export const transcribeAudio = async (req: AudioTranscribeRequest): Promise<AudioTranscribeResponse> => {
    return new Promise(resolve => setTimeout(() => resolve({
        success: true,
        text: "This is a simulated audio transcription. The engine used was Whisper medium model. Processing was accelerated by GPU.",
        language: "en",
        duration: 45.5,
        segments: [{start: 0, end: 10, text: "This is a simulated audio transcription."}],
        execution_time: 3.5
    }), 2000));
};

export const processVideo = async (req: VideoProcessRequest): Promise<VideoProcessResponse> => {
    return new Promise(resolve => setTimeout(() => resolve({
        success: true,
        metadata: { duration: 120, resolution: '1920x1080', codec: 'h264' },
        audio_path: req.extract_audio ? '/tmp/audio_extract.mp3' : undefined,
        subtitle_path: req.generate_subtitle ? '/tmp/video_subs.srt' : undefined,
        execution_time: 5.0
    }), 2500));
};

export const analyzeFile = async (req: FileAnalyzeRequest): Promise<FileAnalyzeResponse> => {
    return new Promise(resolve => setTimeout(() => resolve({
        success: true,
        metadata: { author: "Admin", pages: 12, created: "2023-10-15" },
        text_preview: req.extract_text ? "Document content preview: \nAnalysis Report 2024..." : undefined,
        execution_time: 0.8
    }), 1000));
};

// --- End Tool Implementations ---

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
