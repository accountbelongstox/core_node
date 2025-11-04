# PyMatrix 中心化改进建议

**版本**: 1.0
**日期**: 2025-11-04
**优先级**: 高优先级改进建议
**状态**: 📋 待实施

---

## 🎯 概述

本文档提供具体的代码改进建议，以进一步提升 PyMatrix 的架构中心化水平。当前中心化得分为 **94/100**，通过实施以下改进，可提升至 **98/100**。

---

## 1. API URL 中心化 (高优先级)

### 当前问题

**问题描述**: API服务中存在硬编码的fallback URLs

**影响**:
- 配置不一致
- 环境切换困难
- 运行时配置失效时使用错误的地址

**当前代码**: `services/api/pymatrix/pymatrix-config-api.ts`

```typescript
// ❌ 当前实现 - 有硬编码fallback
const config = useRuntimeConfig();
const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';
```

### 解决方案

#### 方案 A: 创建统一的 API 客户端服务 (推荐)

**文件**: `services/api-client.ts`

```typescript
/**
 * 统一的 API 客户端服务
 * 管理所有API和WebSocket连接的基础URL
 */
export class ApiClient {
  private static instance: ApiClient;
  private baseURL: string;
  private wsBaseURL: string;

  private constructor() {
    const config = useRuntimeConfig();

    // 严格要求配置，不提供fallback
    this.baseURL = config.public.pyMatrixAPI;
    this.wsBaseURL = config.public.pyMatrixWSBase;

    if (!this.baseURL) {
      throw new Error(
        'NUXT_PUBLIC_PYMATRIX_API environment variable is not configured. ' +
        'Please set it in your .env file or runtime config.'
      );
    }

    if (!this.wsBaseURL) {
      throw new Error(
        'NUXT_PUBLIC_PYMATRIX_WS_BASE environment variable is not configured. ' +
        'Please set it in your .env file or runtime config.'
      );
    }

    console.info('[ApiClient] Initialized with:', {
      baseURL: this.baseURL,
      wsBaseURL: this.wsBaseURL,
    });
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 构建HTTP API URL
   * @param path API路径 (例如: /api/devices/list)
   */
  public buildUrl(path: string): string {
    // 确保path以/开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${normalizedPath}`;
  }

  /**
   * 构建WebSocket URL
   * @param path WebSocket路径 (例如: /ws/video/12345)
   */
  public buildWSUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.wsBaseURL}${normalizedPath}`;
  }

  /**
   * 获取HTTP基础URL
   */
  public getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * 获取WebSocket基础URL
   */
  public getWSBaseURL(): string {
    return this.wsBaseURL;
  }
}

/**
 * 便捷函数 - 获取API客户端实例
 */
export function useApiClient(): ApiClient {
  return ApiClient.getInstance();
}
```

#### 更新环境配置

**文件**: `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // API基础URL (HTTP)
      pyMatrixAPI: process.env.NUXT_PUBLIC_PYMATRIX_API || '',

      // WebSocket基础URL
      pyMatrixWSBase: process.env.NUXT_PUBLIC_PYMATRIX_WS_BASE || '',
    },
  },
});
```

**文件**: `.env` (开发环境)

```env
# PyMatrix API Configuration
NUXT_PUBLIC_PYMATRIX_API=http://localhost:8000
NUXT_PUBLIC_PYMATRIX_WS_BASE=ws://localhost:8000
```

**文件**: `.env.production` (生产环境)

```env
# PyMatrix API Configuration (Production)
NUXT_PUBLIC_PYMATRIX_API=https://api.pymatrix.your-domain.com
NUXT_PUBLIC_PYMATRIX_WS_BASE=wss://api.pymatrix.your-domain.com
```

#### 更新现有API服务

**文件**: `services/api/pymatrix/pymatrix-config-api.ts`

```typescript
import { useApiClient } from '@/services/api-client';

export const pyMatrixConfigAPI = {
  async getConfig(): Promise<PyMatrixConfigResponse> {
    const apiClient = useApiClient();
    const url = apiClient.buildUrl('/config');

    const response = await $fetch<ConfigAPIResponse>(url, {
      method: 'GET',
    });

    // ... 其余代码
  },

  async getGlobal(): Promise<DeviceConfig> {
    const apiClient = useApiClient();
    const url = apiClient.buildUrl('/config/global');

    const response = await $fetch<ConfigAPIResponse<DeviceConfig>>(url, {
      method: 'GET',
    });

    // ... 其余代码
  },

  // ... 其余方法类似更新
};
```

---

## 2. WebSocket URL 构建统一化 (高优先级)

### 当前问题

**问题描述**: WebSocket URL在多个composables中重复构建

**影响**:
- 代码重复
- 维护困难
- URL格式不一致风险

**当前代码**: `composables/useDeviceControl.ts`, `composables/useVideoStream.ts` 等

```typescript
// ❌ 当前实现 - 分散构建
const wsUrl = `${options.baseUrl}/ws/control/${options.deviceSerial}`;
```

### 解决方案

#### 创建 WebSocket URL 工具函数

**文件**: `utils/ws-urls.ts`

```typescript
import { useApiClient } from '@/services/api-client';

/**
 * WebSocket URL 工具函数
 * 提供统一的WebSocket URL构建
 */

/**
 * 构建设备控制WebSocket URL
 * @param serial 设备序列号
 */
export function buildControlWSUrl(serial: string): string {
  const apiClient = useApiClient();
  return apiClient.buildWSUrl(`/ws/control/${serial}`);
}

/**
 * 构建视频流WebSocket URL
 * @param serial 设备序列号
 * @param options 视频流选项
 */
export function buildVideoWSUrl(
  serial: string,
  options?: {
    quality?: string;
    fps?: number;
    bitrate?: number;
  }
): string {
  const apiClient = useApiClient();
  let url = `/ws/video/${serial}`;

  if (options) {
    const params = new URLSearchParams();
    if (options.quality) params.append('quality', options.quality);
    if (options.fps) params.append('fps', options.fps.toString());
    if (options.bitrate) params.append('bitrate', options.bitrate.toString());

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return apiClient.buildWSUrl(url);
}

/**
 * 构建设备列表WebSocket URL
 */
export function buildDevicesWSUrl(): string {
  const apiClient = useApiClient();
  return apiClient.buildWSUrl('/ws/devices');
}

/**
 * 构建群组WebSocket URL
 */
export function buildGroupWSUrl(): string {
  const apiClient = useApiClient();
  return apiClient.buildWSUrl('/ws/group');
}
```

#### 更新 Composables

**文件**: `composables/useDeviceControl.ts`

```typescript
import { buildControlWSUrl } from '@/utils/ws-urls';

interface UseDeviceControlOptions {
  deviceSerial: string;
  // ❌ 移除 baseUrl 参数
}

export function useDeviceControl(options: UseDeviceControlOptions) {
  const connected = ref(false);
  const lastAck = ref<any>(null);

  // ✅ 使用统一的URL构建函数
  const wsUrl = buildControlWSUrl(options.deviceSerial);

  const { connect: connectWS, disconnect: disconnectWS, sendMessage, connected: wsConnected } = useWSRPC({
    url: wsUrl,
    onMessage: handleMessage,
    // ... 其余代码
  });

  // ... 其余代码
}
```

**文件**: `composables/useVideoStream.ts`

```typescript
import { buildVideoWSUrl } from '@/utils/ws-urls';

interface UseVideoStreamOptions {
  deviceSerial: string;
  quality?: string;
  fps?: number;
  bitrate?: number;
  // ❌ 移除 baseUrl 参数
}

export function useVideoStream(options: UseVideoStreamOptions) {
  // ✅ 使用统一的URL构建函数
  const wsUrl = buildVideoWSUrl(options.deviceSerial, {
    quality: options.quality,
    fps: options.fps,
    bitrate: options.bitrate,
  });

  // ... 其余代码
}
```

---

## 3. 键盘快捷键 Store (中优先级)

### 当前问题

**问题描述**: 快捷键配置硬编码在composable中

**影响**:
- 用户无法自定义快捷键
- 配置管理分散

**当前代码**: `composables/useKeyboardShortcuts.ts`

```typescript
// ❌ 当前实现 - 硬编码配置
const shortcuts = {
  'Alt+N': 'connect-device',
  'Alt+D': 'disconnect-device',
  // ...
};
```

### 解决方案

#### 创建快捷键 Store

**文件**: `stores_app_pymatrix/keyboardShortcutsStore.ts`

```typescript
import { defineStore } from 'pinia';

interface ShortcutConfig {
  key: string;
  description: string;
  action: string;
  defaultKey: string;
}

interface KeyboardShortcutsState {
  shortcuts: Record<string, ShortcutConfig>;
  enabled: boolean;
}

export const useKeyboardShortcutsStore = defineStore('pymatrix-keyboard-shortcuts', {
  state: (): KeyboardShortcutsState => ({
    shortcuts: {
      connectDevice: {
        key: 'Alt+N',
        description: '连接新设备',
        action: 'connect-device',
        defaultKey: 'Alt+N',
      },
      disconnectDevice: {
        key: 'Alt+D',
        description: '断开当前设备',
        action: 'disconnect-device',
        defaultKey: 'Alt+D',
      },
      toggleGroup: {
        key: 'Alt+G',
        description: '切换群组模式',
        action: 'toggle-group',
        defaultKey: 'Alt+G',
      },
      fullscreen: {
        key: 'Alt+F',
        description: '全屏播放',
        action: 'fullscreen',
        defaultKey: 'Alt+F',
      },
      screenshot: {
        key: 'Alt+S',
        description: '截图',
        action: 'screenshot',
        defaultKey: 'Alt+S',
      },
      startRecording: {
        key: 'Alt+Shift+R',
        description: '开始录制',
        action: 'start-recording',
        defaultKey: 'Alt+Shift+R',
      },
      stopRecording: {
        key: 'Alt+X',
        description: '停止录制',
        action: 'stop-recording',
        defaultKey: 'Alt+X',
      },
      showHelp: {
        key: 'Alt+H',
        description: '显示帮助',
        action: 'show-help',
        defaultKey: 'Alt+H',
      },
      openSettings: {
        key: 'Alt+,',
        description: '打开设置',
        action: 'open-settings',
        defaultKey: 'Alt+,',
      },
      closeDialog: {
        key: 'Escape',
        description: '关闭对话框',
        action: 'close-dialog',
        defaultKey: 'Escape',
      },
    },
    enabled: true,
  }),

  getters: {
    /**
     * 获取所有快捷键配置
     */
    allShortcuts: (state) => state.shortcuts,

    /**
     * 获取快捷键映射 (key -> action)
     */
    shortcutMap: (state): Record<string, string> => {
      const map: Record<string, string> = {};
      Object.values(state.shortcuts).forEach((config) => {
        map[config.key] = config.action;
      });
      return map;
    },

    /**
     * 检查快捷键是否被使用
     */
    isKeyUsed: (state) => (key: string): boolean => {
      return Object.values(state.shortcuts).some((config) => config.key === key);
    },
  },

  actions: {
    /**
     * 更新快捷键
     */
    updateShortcut(actionId: string, newKey: string) {
      if (this.shortcuts[actionId]) {
        // 检查新键是否已被使用
        const existing = Object.entries(this.shortcuts).find(
          ([id, config]) => id !== actionId && config.key === newKey
        );

        if (existing) {
          throw new Error(`Key ${newKey} is already used by ${existing[1].description}`);
        }

        this.shortcuts[actionId].key = newKey;
        this.persistToLocalStorage();
      }
    },

    /**
     * 重置快捷键为默认值
     */
    resetShortcut(actionId: string) {
      if (this.shortcuts[actionId]) {
        this.shortcuts[actionId].key = this.shortcuts[actionId].defaultKey;
        this.persistToLocalStorage();
      }
    },

    /**
     * 重置所有快捷键为默认值
     */
    resetAllShortcuts() {
      Object.keys(this.shortcuts).forEach((actionId) => {
        this.shortcuts[actionId].key = this.shortcuts[actionId].defaultKey;
      });
      this.persistToLocalStorage();
    },

    /**
     * 启用/禁用快捷键
     */
    toggleEnabled() {
      this.enabled = !this.enabled;
      this.persistToLocalStorage();
    },

    /**
     * 从localStorage加载配置
     */
    loadFromLocalStorage() {
      if (process.client) {
        const saved = localStorage.getItem('pymatrix-keyboard-shortcuts');
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.shortcuts) {
              // 合并保存的配置，保留默认值
              Object.keys(data.shortcuts).forEach((actionId) => {
                if (this.shortcuts[actionId]) {
                  this.shortcuts[actionId].key = data.shortcuts[actionId].key;
                }
              });
            }
            if (typeof data.enabled === 'boolean') {
              this.enabled = data.enabled;
            }
          } catch (error) {
            console.error('Failed to load shortcuts from localStorage:', error);
          }
        }
      }
    },

    /**
     * 保存配置到localStorage
     */
    persistToLocalStorage() {
      if (process.client) {
        const data = {
          shortcuts: this.shortcuts,
          enabled: this.enabled,
        };
        localStorage.setItem('pymatrix-keyboard-shortcuts', JSON.stringify(data));
      }
    },
  },
});
```

#### 更新 Composable

**文件**: `composables/useKeyboardShortcuts.ts`

```typescript
import { useKeyboardShortcutsStore } from '@/stores_app_pymatrix/keyboardShortcutsStore';

export function useKeyboardShortcuts() {
  const shortcutsStore = useKeyboardShortcutsStore();

  // ✅ 从store获取快捷键配置
  const shortcutMap = computed(() => shortcutsStore.shortcutMap);
  const enabled = computed(() => shortcutsStore.enabled);

  function handleKeyPress(event: KeyboardEvent) {
    if (!enabled.value) return;

    const key = buildKeyString(event);
    const action = shortcutMap.value[key];

    if (action) {
      event.preventDefault();
      emitAction(action);
    }
  }

  // ... 其余代码
}
```

#### 添加快捷键设置UI

**文件**: `components_app_pymatrix/KeyboardShortcutsSettings.vue`

```vue
<template>
  <div class="shortcuts-settings">
    <div class="shortcuts-settings__header">
      <h3>Keyboard Shortcuts</h3>
      <BaseToggle
        v-model="shortcutsStore.enabled"
        label="Enable shortcuts"
      />
    </div>

    <div class="shortcuts-list">
      <div
        v-for="(config, actionId) in shortcutsStore.allShortcuts"
        :key="actionId"
        class="shortcut-item"
      >
        <div class="shortcut-item__info">
          <span class="shortcut-item__description">{{ config.description }}</span>
          <span class="shortcut-item__action">{{ config.action }}</span>
        </div>

        <div class="shortcut-item__key">
          <input
            v-model="config.key"
            @blur="updateShortcut(actionId, config.key)"
            @keydown.prevent="captureKey($event, actionId)"
            class="shortcut-input"
            readonly
            :placeholder="config.defaultKey"
          />
          <button
            @click="shortcutsStore.resetShortcut(actionId)"
            class="reset-btn"
            title="Reset to default"
          >
            ↺
          </button>
        </div>
      </div>
    </div>

    <div class="shortcuts-settings__footer">
      <BaseButton
        @click="shortcutsStore.resetAllShortcuts()"
        variant="outline"
      >
        Reset All to Defaults
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcutsStore } from '@/stores_app_pymatrix/keyboardShortcutsStore';

const shortcutsStore = useKeyboardShortcutsStore();

function captureKey(event: KeyboardEvent, actionId: string) {
  const key = buildKeyString(event);
  try {
    shortcutsStore.updateShortcut(actionId, key);
  } catch (error) {
    // 显示错误提示
    console.error(error);
  }
}

function buildKeyString(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  const key = event.key === ' ' ? 'Space' : event.key;
  parts.push(key.charAt(0).toUpperCase() + key.slice(1));

  return parts.join('+');
}

function updateShortcut(actionId: string, key: string) {
  try {
    shortcutsStore.updateShortcut(actionId, key);
  } catch (error) {
    // 恢复原值
    shortcutsStore.shortcuts[actionId].key = shortcutsStore.shortcuts[actionId].key;
  }
}
</script>
```

---

## 4. 配置文件中心化 (低优先级)

### 当前问题

**问题描述**: 配置常量分散在多个文件

**当前位置**:
- `config_app_pymatrix/index.ts` - 基础配置
- `config_app_pymatrix/deviceConfigFields.ts` - 设备配置字段

### 解决方案

#### 合并配置文件

**文件**: `config_app_pymatrix/index.ts`

```typescript
/**
 * PyMatrix 配置中心
 * 所有应用级配置集中管理
 */

export const PYMATRIX_CONFIG = {
  /**
   * 视频质量预设
   */
  VIDEO_QUALITIES: {
    high: {
      name: 'high',
      fps: 60,
      bitrate: 8000000,
      resolution: { width: 1440, height: 3120 },
    },
    medium: {
      name: 'medium',
      fps: 30,
      bitrate: 4000000,
      resolution: { width: 720, height: 1560 },
    },
    low: {
      name: 'low',
      fps: 15,
      bitrate: 2000000,
      resolution: { width: 540, height: 1170 },
    },
  },

  /**
   * 录制格式
   */
  RECORDING_FORMATS: ['mp4', 'mkv', 'avi'] as const,

  /**
   * 录制模式
   */
  RECORDING_MODES: ['normal', 'background'] as const,

  /**
   * 网格布局列数范围
   */
  GRID_COLUMNS: {
    min: 1,
    max: 6,
    default: 3,
  },

  /**
   * WebSocket重连配置
   */
  WEBSOCKET: {
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
  },

  /**
   * UI配置
   */
  UI: {
    toastDuration: 3000,
    modalTransitionDuration: 300,
    deviceCardMinWidth: 200,
    deviceCardMaxWidth: 400,
  },

  /**
   * 系统监控配置
   */
  MONITORING: {
    healthCheckInterval: 5000,
    performanceLogInterval: 10000,
  },
} as const;

export default PYMATRIX_CONFIG;

/**
 * 类型导出
 */
export type VideoQuality = keyof typeof PYMATRIX_CONFIG.VIDEO_QUALITIES;
export type RecordingFormat = typeof PYMATRIX_CONFIG.RECORDING_FORMATS[number];
export type RecordingMode = typeof PYMATRIX_CONFIG.RECORDING_MODES[number];
```

---

## 5. 实施路线图

### 阶段 1: 高优先级改进 (预计4-6小时)

- [ ] 创建 `services/api-client.ts` (1小时)
- [ ] 更新环境配置文件 (0.5小时)
- [ ] 更新 `pymatrix-config-api.ts` (0.5小时)
- [ ] 创建 `utils/ws-urls.ts` (1小时)
- [ ] 更新所有composables使用新的URL工具 (1-2小时)
- [ ] 测试所有API和WebSocket连接 (1小时)

### 阶段 2: 中优先级改进 (预计4-6小时)

- [ ] 创建 `keyboardShortcutsStore.ts` (2小时)
- [ ] 更新 `useKeyboardShortcuts.ts` (1小时)
- [ ] 创建快捷键设置UI组件 (2小时)
- [ ] 集成到设置对话框 (1小时)

### 阶段 3: 低优先级改进 (预计2小时)

- [ ] 合并配置文件 (1小时)
- [ ] 更新所有配置引用 (1小时)

### 总计预估时间: 10-14小时

---

## 6. 预期效果

实施所有改进后:

- **中心化得分**: 94 → 98 (+4分)
- **API中心化**: 90 → 98 (+8分)
- **数据中心化**: 95 → 98 (+3分)
- **可维护性**: 显著提升
- **配置管理**: 更加清晰统一
- **用户体验**: 支持自定义快捷键

---

## 7. 注意事项

1. **环境变量配置**: 确保所有环境都正确配置API地址
2. **向后兼容**: 实施时考虑现有代码的兼容性
3. **测试覆盖**: 每个改进后进行充分测试
4. **文档更新**: 更新开发文档反映新的架构

---

**文档维护**: 随着实施进展更新状态
**责任人**: Frontend Team
**审核**: Architecture Team
