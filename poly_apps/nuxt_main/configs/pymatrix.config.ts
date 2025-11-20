export default {
  name: 'pyMatrix',
  namespace: 'pymatrix',
  displayName: 'pyMatrix Device Control',
  description: 'Android device mirroring and group control system',

  routes: {
    prefix: '/pymatrix',
    pages: [
      'pymatrix',
      'pymatrix-devices',
      'pymatrix-groups',
      'pymatrix-settings'
    ]
  },

  theme: {
    primary: '#3b82f6',      // Blue
    secondary: '#8b5cf6',    // Purple
    layout: 'pymatrix',
    dark: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      text: '#ffffff'
    },
    light: {
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#000000'
    }
  },

  api: {
    namespace: 'pymatrix',
    baseUrl: 'http://localhost:8000',
    wsBaseUrl: 'ws://localhost:8000',
    endpoints: {
      health: '/api/health',
      devices: '/api/devices',
      video: '/ws/video',
      control: '/ws/control',
      group: '/ws/group'
    },
    version: 'v1'
  },

  features: {
    videoStreaming: true,
    deviceControl: true,
    groupControl: true,
    touchInput: true,
    keyboardInput: true,
    multiDevice: true,
    realtime: true
  },

  permissions: {
    required: ['pymatrix.access'],
    roles: ['user', 'developer', 'admin']
  },

  settings: {
    maxDevices: 10,
    defaultQuality: 'high',
    enableAudio: false,
    videoCodec: 'h264',
    streamFormat: 'fmp4'
  }
};
