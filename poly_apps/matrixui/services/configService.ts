/**
 * Configuration Service - Manages frontend config data structure and backend synchronization
 * 
 * Features:
 * - Frontend config data structure (matches backend)
 * - Backend config sync (RPC v2)
 * - Real-time config change notifications
 * - Video stream mode switching (H.264/YUV)
 * 
 * Note: Config is always fetched from backend, no local storage cache
 */

import { wsService } from './websocket';

/**
 * Global configuration structure (matches backend)
 */
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

/**
 * Default configuration (used as fallback)
 */
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

/**
 * Device-specific configuration
 */
export interface DeviceConfig {
  deviceName: string;
  config: Partial<GlobalConfig>;
}

/**
 * Full configuration (global + all devices)
 */
export interface FullConfig {
  global: GlobalConfig;
  devices: Record<string, Partial<GlobalConfig>>;
}

const CONFIG_CHANGE_EVENT = 'config:changed';

class ConfigService {
  private config: GlobalConfig = DEFAULT_CONFIG;
  private listeners: Set<(config: GlobalConfig) => void> = new Set();
  private initialized: boolean = false;
  private rpcConnected: boolean = false;

  /**
   * Initialize configuration service
   * Uses default config initially, then fetches from backend when RPC is connected
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Start with default config
    this.config = { ...DEFAULT_CONFIG };
    this.notifyListeners();
    this.initialized = true;

    // Try to load from backend if RPC is already connected
    if (wsService.isRpcConnected()) {
      await this.refresh();
    } else {
      console.log('[ConfigService] Using default config, will load from backend when RPC connects');
    }
  }

  /**
   * Called when RPC connection is established
   */
  async onRpcConnected(): Promise<void> {
    if (this.rpcConnected) return;
    
    this.rpcConnected = true;
    console.log('[ConfigService] RPC connected, loading config from backend...');
    
    try {
      await this.refresh();
    } catch (error) {
      console.error('[ConfigService] Failed to load config after RPC connection:', error);
    }
  }

  /**
   * Called when RPC connection is lost
   */
  onRpcDisconnected(): void {
    this.rpcConnected = false;
    console.log('[ConfigService] RPC disconnected');
  }

  /**
   * Refresh configuration from backend
   */
  async refresh(): Promise<void> {
    try {
      if (wsService.isRpcConnected()) {
        const result = await wsService.callRpc('config.global', {});
        // Backend returns: { "success": true, "config": {...} }
        if (result && result.config) {
          this.config = { ...DEFAULT_CONFIG, ...result.config };
          console.log('[ConfigService] Loaded config from backend:', this.config);
          this.notifyListeners();
        } else if (result && result.global) {
          // Fallback for old format
          this.config = { ...DEFAULT_CONFIG, ...result.global };
          console.log('[ConfigService] Loaded config from backend (old format):', this.config);
          this.notifyListeners();
        } else {
          console.warn('[ConfigService] Backend returned empty config, using default');
          this.config = { ...DEFAULT_CONFIG };
          this.notifyListeners();
        }
      } else {
        console.warn('[ConfigService] RPC not connected, cannot load config');
        // Use default config
        this.config = { ...DEFAULT_CONFIG };
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[ConfigService] Failed to load config from backend:', error);
      // Use default config on error
      this.config = { ...DEFAULT_CONFIG };
      this.notifyListeners();
    }
  }

  /**
   * Get current configuration
   * Always returns a config (default if not loaded from backend)
   */
  getConfig(): GlobalConfig {
    return { ...this.config };
  }

  /**
   * Update global configuration
   * 1. Immediately sync to backend
   * 2. Refresh from backend to get updated config
   * 3. Notify all listeners
   */
  async updateConfig(updates: Partial<GlobalConfig>): Promise<void> {
    // Sync to backend
    try {
      if (wsService.isRpcConnected()) {
        await wsService.callRpc('config.global_update', updates);
        console.log('[ConfigService] Config updated and synced to backend:', updates);
        
        // Refresh from backend to get the updated config
        await this.refresh();
        
        // Dispatch custom event
        if (this.config) {
          window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: this.config }));
        }
      } else {
        throw new Error('RPC not connected');
      }
    } catch (error) {
      console.error('[ConfigService] Failed to sync config to backend:', error);
      throw error;
    }
  }

  /**
   * Get device-specific configuration
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
   * Update device-specific configuration
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
   * Delete device configuration (revert to global config)
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
   * Get full configuration (global + all devices)
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
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: GlobalConfig) => void): () => void {
    this.listeners.add(listener);
    // Call immediately once with current config
    listener(this.config);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
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

// Singleton instance
export const configService = new ConfigService();

