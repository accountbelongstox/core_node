import type { Device } from '@/types/pymatrix';
import type { DetailedHealthResponse } from '@/services/api/pymatrix/pymatrix-health-api';

const now = () => new Date().toISOString();

export const INITIAL_DEVICES: Device[] = [
  {
    serial: 'PMX-001',
    name: 'Demo Pixel 8 Pro',
    model: 'Pixel 8 Pro',
    state: 'connected',
    resolution: { width: 1344, height: 2992 },
    streaming: true,
    controllable: true,
    isHost: true,
    tags: ['lab', 'qa']
  },
  {
    serial: 'PMX-002',
    name: 'Galaxy S23 Ultra',
    model: 'SM-S9180',
    state: 'connected',
    resolution: { width: 1440, height: 3088 },
    streaming: false,
    controllable: true,
    tags: ['demo']
  },
  {
    serial: 'PMX-003',
    name: 'OnePlus 12R',
    model: 'CPH2585',
    state: 'connecting',
    resolution: { width: 1240, height: 2772 },
    streaming: false,
    controllable: false,
    tags: ['staging']
  }
];

export const FALLBACK_HEALTH_RESPONSE: DetailedHealthResponse = {
  status: 'healthy',
  service: {
    name: 'pyMatrix (demo)',
    version: '1.0.0',
    description: 'Fallback telemetry while backend is offline'
  },
  timestamp: now(),
  uptime_seconds: 300,
  system: {
    platform: 'demo-os',
    platform_version: 'v1.0',
    python_version: '3.11',
    architecture: 'x86_64'
  },
  resources: {
    cpu: {
      usage_percent: 18,
      cores: 8
    },
    memory: {
      total_mb: 16384,
      available_mb: 11200,
      used_percent: 31.6
    },
    disk: {
      total_gb: 512,
      free_gb: 340,
      used_percent: 33.6
    }
  },
  performance_metrics: {
    'api.requests_per_minute': 42,
    'ws.active_connections': 3,
    'workers.queue_depth': 0
  }
};
