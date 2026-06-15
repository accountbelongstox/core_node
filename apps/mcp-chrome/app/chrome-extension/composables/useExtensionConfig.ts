/**
 * 扩展配置中心化管理
 * Centralized extension configuration management
 */

import { ref, computed, watch } from 'vue';
import type { Ref, Component } from 'vue';

// ============================================================
// 类型定义
// ============================================================

export interface ExtensionConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  component?: Component;
  status: 'active' | 'todo' | 'inactive';
  enabled: boolean;
  config?: any; // 扩展特定配置
}

export interface ExtensionRegistry {
  [key: string]: Omit<ExtensionConfig, 'enabled' | 'config'>;
}

// ============================================================
// 默认扩展注册表
// ============================================================

const EXTENSION_REGISTRY: ExtensionRegistry = {
  'queue-center': {
    id: 'queue-center',
    name: 'Task Queue & Logs',
    description: 'Unified task queue (serial processing) and its event logs',
    icon: '📋',
    iconBg: 'bg-purple-100',
    status: 'active',
  },
  'bing-dictionary': {
    id: 'bing-dictionary',
    name: 'Bing Dictionary',
    description: 'Look up word definitions and translations',
    icon: '📚',
    iconBg: 'bg-orange-100',
    status: 'active',
  },
  'notebooklm': {
    id: 'notebooklm',
    name: 'NotebookLM',
    description: 'Automate Google NotebookLM Q&A',
    icon: '📓',
    iconBg: 'bg-sky-100',
    status: 'active',
  },
};

// ============================================================
// 存储键
// ============================================================

const STORAGE_KEY = 'extensionConfigs';

// ============================================================
// 全局状态
// ============================================================

const extensions: Ref<ExtensionConfig[]> = ref([]);
const expandedExtensions: Ref<string[]> = ref([]);
let isInitialized = false;

// ============================================================
// 辅助函数
// ============================================================

/**
 * 获取默认扩展配置
 */
function getDefaultExtensions(): ExtensionConfig[] {
  return Object.values(EXTENSION_REGISTRY).map(ext => ({
    ...ext,
    enabled: ext.id === 'queue-center' || ext.id === 'bing-dictionary',
    config: {},
  }));
}

/**
 * 合并存储的配置和默认配置
 */
function mergeWithDefaults(stored: Partial<ExtensionConfig>[]): ExtensionConfig[] {
  const defaults = getDefaultExtensions();

  return defaults.map(defaultExt => {
    const storedExt = stored.find(s => s.id === defaultExt.id);
    return {
      ...defaultExt,
      ...storedExt,
      // 确保组件引用不被存储覆盖
      component: defaultExt.component,
    };
  });
}

// ============================================================
// Composable
// ============================================================

export function useExtensionConfig() {
  // ============================================================
  // 初始化
  // ============================================================

  const initialize = async () => {
    if (isInitialized) return;

    try {
      const stored = await chrome.storage.local.get([STORAGE_KEY]);

      if (stored[STORAGE_KEY] && Array.isArray(stored[STORAGE_KEY])) {
        extensions.value = mergeWithDefaults(stored[STORAGE_KEY]);
      } else {
        extensions.value = getDefaultExtensions();
      }

      console.log('[ExtensionConfig] Initialized with', extensions.value.length, 'extensions');
      isInitialized = true;
    } catch (error) {
      console.error('[ExtensionConfig] Failed to initialize:', error);
      extensions.value = getDefaultExtensions();
      isInitialized = true;
    }
  };

  // ============================================================
  // 自动保存
  // ============================================================

  watch(extensions, async (newExtensions) => {
    if (!isInitialized) return;

    try {
      // 保存时移除component引用（不能序列化）
      const toSave = newExtensions.map(({ component, ...rest }) => rest);
      await chrome.storage.local.set({ [STORAGE_KEY]: toSave });
      console.log('[ExtensionConfig] Saved to storage');
    } catch (error) {
      console.error('[ExtensionConfig] Failed to save:', error);
    }
  }, { deep: true });

  // ============================================================
  // 扩展管理
  // ============================================================

  /**
   * 切换扩展启用状态
   */
  const toggleExtension = (id: string) => {
    const ext = extensions.value.find(e => e.id === id);
    if (ext) {
      ext.enabled = !ext.enabled;
      console.log(`[ExtensionConfig] Extension ${ext.name} ${ext.enabled ? 'enabled' : 'disabled'}`);

      // 通知background扩展配置变化
      chrome.runtime.sendMessage({
        type: 'extension_config_changed',
        extensionId: id,
        enabled: ext.enabled,
      }).catch(err => {
        console.debug('[ExtensionConfig] Background not ready:', err.message);
      });
    }
  };

  /**
   * 注册组件引用（在UI层调用）
   */
  const registerComponent = (id: string, component: Component) => {
    const ext = extensions.value.find(e => e.id === id);
    if (ext) {
      ext.component = component;
    }
  };

  /**
   * 获取扩展配置
   */
  const getExtension = (id: string): ExtensionConfig | undefined => {
    return extensions.value.find(e => e.id === id);
  };

  /**
   * 更新扩展特定配置
   */
  const updateExtensionConfig = (id: string, config: any) => {
    const ext = extensions.value.find(e => e.id === id);
    if (ext) {
      ext.config = { ...ext.config, ...config };
    }
  };

  // ============================================================
  // 展开状态管理
  // ============================================================

  /**
   * 切换扩展展开状态
   */
  const toggleExpanded = (id: string) => {
    const index = expandedExtensions.value.indexOf(id);
    if (index > -1) {
      expandedExtensions.value.splice(index, 1);
    } else {
      expandedExtensions.value.push(id);
    }
  };

  /**
   * 展开所有扩展
   */
  const expandAll = () => {
    expandedExtensions.value = extensions.value.map(e => e.id);
  };

  /**
   * 收起所有扩展
   */
  const collapseAll = () => {
    expandedExtensions.value = [];
  };

  /**
   * 切换全部展开/收起
   */
  const toggleExpandAll = () => {
    if (isAllExpanded.value) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  // ============================================================
  // Computed
  // ============================================================

  const enabledExtensions = computed(() =>
    extensions.value.filter(e => e.enabled)
  );

  const enabledExtensionsCount = computed(() =>
    enabledExtensions.value.length
  );

  const activeExtensions = computed(() =>
    extensions.value.filter(e => e.status === 'active')
  );

  const isAllExpanded = computed(() =>
    expandedExtensions.value.length === extensions.value.length
  );

  const isExpanded = (id: string) => computed(() =>
    expandedExtensions.value.includes(id)
  );

  // ============================================================
  // 重置
  // ============================================================

  const resetToDefaults = async () => {
    extensions.value = getDefaultExtensions();
    expandedExtensions.value = [];
    await chrome.storage.local.set({ [STORAGE_KEY]: extensions.value });
    console.log('[ExtensionConfig] Reset to defaults');
  };

  // ============================================================
  // 返回
  // ============================================================

  return {
    // 状态
    extensions,
    expandedExtensions,

    // 初始化
    initialize,

    // 扩展管理
    toggleExtension,
    registerComponent,
    getExtension,
    updateExtensionConfig,

    // 展开状态
    toggleExpanded,
    expandAll,
    collapseAll,
    toggleExpandAll,
    isExpanded,

    // Computed
    enabledExtensions,
    enabledExtensionsCount,
    activeExtensions,
    isAllExpanded,

    // 重置
    resetToDefaults,
  };
}
