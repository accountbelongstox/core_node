export const PYMATRIX_CONFIG = {
  API_BASE_URL: 'http://localhost:8000',
  WS_BASE_URL: 'ws://localhost:8000',
  DEFAULT_BITRATE: 8000000,
  DEFAULT_MAX_SIZE: 720,
  DEFAULT_FPS: 60,
  VIDEO_QUALITIES: {
    high: {
      name: 'high',
      fps: 60,
      bitrate: 8000000,
      resolution: { width: 1440, height: 3120 }
    },
    medium: {
      name: 'medium',
      fps: 30,
      bitrate: 4000000,
      resolution: { width: 720, height: 1560 }
    },
    low: {
      name: 'low',
      fps: 15,
      bitrate: 2000000,
      resolution: { width: 540, height: 1170 }
    }
  }
};

export default PYMATRIX_CONFIG;
