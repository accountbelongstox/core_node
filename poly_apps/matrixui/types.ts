

export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  CONTROL = 'CONTROL', // Full remote view
}

export enum UnitStatus {
  ONLINE = 'ONLINE',
  IDLE = 'IDLE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE'
}

export interface Unit {
  id: string;
  name: string;
  type: string;
  status: UnitStatus;
  battery: number;
  cpuLoad: number;
  temperature: number;
  location: { x: number; y: number };
  firmwareVersion: string;
  lastPing: number;
}

export interface Device {
  serial: string;
  model: string;
  version: string;
  status: 'online' | 'offline' | 'busy';
  battery: number;
  resolution: string;
  groupId: string;
  tags: string[];
  ip: string;
  ping: number;
  name?: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  parentId: string | null;
  children?: DeviceGroup[];
}

export interface DeviceLog {
  time: string;
  type: 'info' | 'error' | 'warning' | 'success';
  msg: string;
}

export type BatchActionType = 
  | 'screenshot' 
  | 'recording' 
  | 'install' 
  | 'home' 
  | 'back' 
  | 'power' 
  | 'script'
  | 'input_text'
  | 'recent'
  | 'swipe_up'
  | 'swipe_down'
  | 'launch_tiktok'
  | 'launch_insta'
  | 'launch_wechat'
  | 'launch_momo'
  | 'launch_youtube'
  | 'launch_facebook'
  | 'launch_whatsapp'
  | 'set_brightness'
  | 'set_rotation'
  | 'set_clipboard';

export interface AICommandResponse {
  analysis: string;
  targetUnitIds: string[];
  action: 'REBOOT' | 'SHUTDOWN' | 'ACTIVATE' | 'OPTIMIZE' | 'DIAGNOSE' | 'UPDATE_FIRMWARE' | 'NONE';
}

// --- Script Engine Types ---

export type AppPlatform = 'tiktok' | 'instagram' | 'wechat' | 'facebook' | 'youtube' | 'whatsapp' | 'momo' | 'general';

export interface ScriptStep {
  id: string;
  type: 'open_app' | 'click' | 'swipe' | 'input' | 'delay' | 'check' | 'loop';
  label: string;
  description?: string;
  duration?: number; // seconds
  icon?: string;
}

export interface ScriptDef {
  id: string;
  name: string;
  description: string;
  platform: AppPlatform;
  tags: string[];
  estimatedTime: string;
  steps: ScriptStep[];
}

// --- File System & Config Types (Alignment v2.0) ---

export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

export interface PackageInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
  isSystem: boolean;
  icon?: string;
}

export interface StreamConfig {
  max_size: number;     // 120-4320
  bit_rate: number;     // 100000-20000000
  max_fps: number;      // 1-120
  codec: 'h264' | 'h265' | 'av1';
  locked_video_orientation: -1 | 0 | 1 | 2 | 3;
}

// --- Media Gallery Types (New) ---

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string; // Mock url or blob url
  thumbnail?: string;
  timestamp: string;
  deviceSerial: string;
  duration?: string; // For videos
  size: string;
}