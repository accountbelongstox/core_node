export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  CONTROL = 'CONTROL', // Full remote view
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

export type BatchActionType = 'screenshot' | 'recording' | 'install' | 'home' | 'back' | 'power' | 'script';