/**
 * Configuration Service - Manages frontend config cache and backend synchronization
 * 
 * Features:
 * - Frontend config cache (localStorage)
 * - Backend config sync (RPC v2)
 * - Real-time config change notifications
 * - Video stream mode switching (H.264/YUV)
 */

import { wsService } from './websocket';

export interface GlobalConfig {
  max_size: number;
  bit_rate: number;
  max_fps: number;
  codec: 'h264' | 'h265' | 'av1';
  control: boolean;
  locked_video_orientation: number;
  video_stream_mode: 'h264' | 'yuv'; // Video stream mode
  hwaccel?: 'cuda' | 'qsv' | 'dxva2' | 'vaapi' | 'auto'; // Hardware acceleration
}

export interface DeviceConfig {
  deviceName: string;
  config: Partial<GlobalConfig>;
}

export interface FullConfig {
  global: GlobalConfig;
  devices: Record<string, Partial<GlobalConfig>>;
}

const DEFAULT_CONFIG: GlobalConfig = {
  max_size: 720,
  bit_rate: 8000000,
  max_fps: 60,
  codec: 'h264',
  control: true,
  locked_video_orientation: -1,
  video_stream_mode: 'h264',
  hwaccel: 'auto'
};

const CONFIG_STORAGE_KEY = 'matrix_global_config';
const CONFIG_CHANGE_EVENT = 'config:changed';

class ConfigService {
  private config: GlobalConfig = DEFAULT_CONFIG;
  private listeners: Set<(config: GlobalConfig) => void> = new Set();
  private initialized: boolean = false;

  /**
   * 初始化配置服务
   * 1. 从 localStorage 加载缓存
   * 2. 从后端获取最新配置
   * 3. 合并并应用
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. 从 localStorage 加载缓存
    const cached = this.loadFromCache();
    if (cached) {
      this.config = { ...DEFAULT_CONFIG, ...cached };
      console.log('[ConfigService] Loaded config from cache:', this.config);
    }

    // 2. 从后端获取最新配置
    try {
      if (wsService.isRpcConnected()) {
        const result = await wsService.callRpc('config.global', {});
        if (result && result.global) {
          this.config = { ...DEFAULT_CONFIG, ...result.global };
          this.saveToCache(this.config);
          console.log('[ConfigService] Loaded config from backend:', this.config);
        }
      }
    } catch (error) {
      console.warn('[ConfigService] Failed to load config from backend, using cache:', error);
    }

    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * 获取当前配置
   */
  getConfig(): GlobalConfig {
    return { ...this.config };
  }

  /**
   * 更新全局配置
   * 1. 更新本地缓存
   * 2. 立即同步到后端
   * 3. 通知所有监听器
   */
  async updateConfig(updates: Partial<GlobalConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    // 保存到缓存
    this.saveToCache(this.config);
    
    // 同步到后端
    try {
      if (wsService.isRpcConnected()) {
        await wsService.callRpc('config.global_update', updates);
        console.log('[ConfigService] Config updated and synced to backend:', updates);
      } else {
        console.warn('[ConfigService] RPC not connected, config saved to cache only');
      }
    } catch (error) {
      console.error('[ConfigService] Failed to sync config to backend:', error);
      // 回滚配置
      this.config = oldConfig;
      throw error;
    }

    // 通知监听器
    this.notifyListeners();
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: this.config }));
  }

  /**
   * 获取设备特定配置
   */
  async getDeviceConfig(deviceName: string): Promise<Partial<GlobalConfig> | null> {
    try {
      if (wsService.isRpcConnected()) {
        const result = await wsService.callRpc('config.device', { deviceName });
        return result?.config || null;
      }
    } catch (error) {
      console.error(`[ConfigService] Failed to get device config for ${deviceName}:`, error);
    }
    return null;
  }

  /**
   * 更新设备特定配置
   */
  async updateDeviceConfig(deviceName: string, config: Partial<GlobalConfig>): Promise<void> {
    try {
      if (wsService.isRpcConnected()) {
        await wsService.callRpc('config.device_update', { deviceName, config });
        console.log(`[ConfigService] Device config updated for ${deviceName}:`, config);
      }
    } catch (error) {
      console.error(`[ConfigService] Failed to update device config for ${deviceName}:`, error);
      throw error;
    }
  }

  /**
   * 删除设备配置（恢复为全局配置）
   */
  async deleteDeviceConfig(deviceName: string): Promise<void> {
    try {
      if (wsService.isRpcConnected()) {
        await wsService.callRpc('config.device_delete', { deviceName });
        console.log(`[ConfigService] Device config deleted for ${deviceName}`);
      }
    } catch (error) {
      console.error(`[ConfigService] Failed to delete device config for ${deviceName}:`, error);
      throw error;
    }
  }

  /**
   * 获取完整配置（全局 + 所有设备）
   */
  async getFullConfig(): Promise<FullConfig> {
    try {
      if (wsService.isRpcConnected()) {
        const result = await wsService.callRpc('config.full', {});
        return result || { global: this.config, devices: {} };
      }
    } catch (error) {
      console.error('[ConfigService] Failed to get full config:', error);
    }
    return { global: this.config, devices: {} };
  }

  /**
   * 订阅配置变更
   */
  subscribe(listener: (config: GlobalConfig) => void): () => void {
    this.listeners.add(listener);
    // 立即调用一次
    listener(this.config);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 从 localStorage 加载配置
   */
  private loadFromCache(): Partial<GlobalConfig> | null {
    try {
      const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('[ConfigService] Failed to load config from cache:', error);
    }
    return null;
  }

  /**
   * 保存配置到 localStorage
   */
  private saveToCache(config: GlobalConfig): void {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('[ConfigService] Failed to save config to cache:', error);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('[ConfigService] Error in config listener:', error);
      }
    });
  }
}

// 单例
export const configService = new ConfigService();

