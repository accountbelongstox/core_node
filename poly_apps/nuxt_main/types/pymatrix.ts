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
}

export interface VideoMetadata {
  fps: number;
  droppedFrames: number;
  latency: number;
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
