export interface Device {
  serial: string;
  name: string;
  model: string;
  state: 'connected' | 'disconnected' | 'connecting';
  resolution: {
    width: number;
    height: number;
  };
  streaming: boolean;
  controllable: boolean;
  isHost?: boolean;
  tags?: string[];
}

export interface VideoMetadata {
  fps: number;
  droppedFrames: number;
  latency: number;
}

export interface DeviceConfig {
  max_size: number;
  bit_rate: number;
  max_fps: number;
  codec: 'h264' | 'h265' | 'av1';
  control: boolean;
  locked_video_orientation: number;
}

export interface PyMatrixConfigResponse {
  success: boolean;
  config: {
    global: DeviceConfig;
    devices: Record<string, DeviceConfig>;
  };
}

export interface TouchEvent {
  action: 'down' | 'up' | 'move';
  pointerId: number;
  x: number;
  y: number;
  pressure: number;
  screenWidth: number;
  screenHeight: number;
}

export interface KeyEvent {
  action: 'down' | 'up';
  keyCode: number;
  metaState: number;
}

export interface WSRPCMessage {
  type: string;
  timestamp: number;
  data: any;
}

export interface VideoInitMessage {
  serial: string;
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

export interface GroupState {
  groupId: string;
  hostSerial: string | null;
  slaves: Device[];
  totalDevices: number;
}

export type VideoQuality = 'high' | 'medium' | 'low';

export interface VideoQualityConfig {
  name: VideoQuality;
  fps: number;
  bitrate: number;
  resolution: {
    width: number;
    height: number;
  };
}

export type RecordingFormat = 'mp4' | 'mkv';
export type RecordingMode = 'normal' | 'background';

export interface RecordingState {
  deviceSerial: string;
  isRecording: boolean;
  format: RecordingFormat;
  mode: RecordingMode;
  startTime?: number;
  duration?: number;
  filePath?: string;
  fileSize?: number;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpg';
  quality?: number;
  savePath?: string;
}

export interface ClipboardData {
  text: string;
  timestamp: number;
  source: 'device' | 'pc';
}

export interface ClipboardSyncState {
  deviceSerial: string;
  enabled: boolean;
  lastSync?: ClipboardData;
  autoSync: boolean;
}

export interface FileTransferProgress {
  id: string;
  deviceSerial: string;
  fileName: string;
  fileSize: number;
  transferredBytes: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startTime: number;
  endTime?: number;
  speed?: number;
}

export interface ApkInstallProgress {
  id: string;
  deviceSerial: string;
  apkName: string;
  apkSize: number;
  status: 'uploading' | 'installing' | 'installed' | 'failed';
  progress: number;
  error?: string;
}

export interface BatchOperationResult {
  groupId: string;
  operation: 'screenshot' | 'recording' | 'systemkey' | 'text' | 'clipboard';
  deviceResults: Array<{
    serial: string;
    success: boolean;
    message?: string;
    data?: any;
  }>;
  successCount: number;
  failureCount: number;
  timestamp: number;
}

export interface ScreenControlOptions {
  power?: 'on' | 'off' | 'toggle';
  brightness?: number;
  rotation?: 0 | 90 | 180 | 270;
  keepAwake?: boolean;
  autoSleep?: boolean;
}

export interface GroupTreeNode {
  id: string;
  name: string;
  type: 'group' | 'device';
  children?: GroupTreeNode[];
  deviceSerial?: string;
  scriptPath?: string;
  selected?: boolean;
  exists?: boolean;
}

export interface UIPreferences {
  gridColumns: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'zh';
  simpleMode: boolean;
  showFPS: boolean;
  showTouch: boolean;
  alwaysOnTop: boolean;
  recordingPath: string;
  screenshotPath: string;
}

export type ScriptStepType = 'touch' | 'key' | 'text' | 'swipe' | 'system' | 'wait' | 'screenshot' | 'clipboard';

export interface ScriptStep {
  id: string;
  type: ScriptStepType;
  name: string;
  description?: string;
  data: ScriptStepData;
  delay: number; // milliseconds before next step
  enabled: boolean;
}

export interface ScriptStepData {
  // Touch action
  action?: 'down' | 'up' | 'move' | 'tap' | 'long_press';
  x?: number;
  y?: number;
  duration?: number;

  // Key action
  keyCode?: number;
  keyName?: string;

  // Text input
  text?: string;

  // Swipe action
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  swipeDuration?: number;

  // System key
  systemKey?: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down';

  // Wait action
  waitDuration?: number;

  // Screenshot
  screenshotFormat?: 'png' | 'jpg';

  // Clipboard
  clipboardAction?: 'set' | 'get';
  clipboardText?: string;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: ScriptStep[];
  createdAt: string;
  updatedAt: string;
  author?: string;
  version: string;
  targetDevices?: string[]; // device serials or 'all'
  loopEnabled: boolean;
  loopCount?: number;
  scheduleEnabled: boolean;
  scheduleTime?: string;
  scheduleRepeat?: 'once' | 'daily' | 'weekly' | 'custom';
}

export interface ScriptExecutionState {
  scriptId: string;
  deviceSerial: string;
  status: 'idle' | 'recording' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
  totalSteps: number;
  startTime?: number;
  endTime?: number;
  error?: string;
  loopIteration?: number;
}

export interface ScriptCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  scriptCount: number;
}

export type AudioStreamingState = 'idle' | 'installing' | 'starting' | 'streaming' | 'stopping' | 'error';

export interface AudioStreamStatus {
  deviceSerial: string;
  state: AudioStreamingState;
  isInstalled: boolean;
  isStreaming: boolean;
  error?: string;
  startTime?: number;
  duration?: number;
}

export interface AudioInstallProgress {
  deviceSerial: string;
  progress: number;
  status: string;
  error?: string;
}

export interface AudioStreamMetadata {
  deviceSerial: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  codec: string;
}
