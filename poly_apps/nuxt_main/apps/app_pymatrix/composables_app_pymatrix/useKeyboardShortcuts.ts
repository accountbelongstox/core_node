/**
 * Keyboard Shortcuts Composable
 *
 * Provides keyboard shortcuts for pymatrix app
 * 为pymatrix应用提供键盘快捷键支持
 */

import { onMounted, onUnmounted } from 'vue';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category?: string;
  action: () => void;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { shortcuts, enabled = true } = options;

  function handleKeyDown(event: KeyboardEvent) {
    if (!enabled) return;

    // 查找匹配的快捷键
    const matchedShortcut = shortcuts.find(shortcut => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (matchedShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchedShortcut.action();

      console.log('[useKeyboardShortcuts] Shortcut triggered:', {
        key: matchedShortcut.key,
        ctrl: matchedShortcut.ctrl,
        shift: matchedShortcut.shift,
        alt: matchedShortcut.alt,
        description: matchedShortcut.description
      });
    }
  }

  onMounted(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      console.log('[useKeyboardShortcuts] Shortcuts registered:', shortcuts.length);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    console.log('[useKeyboardShortcuts] Shortcuts unregistered');
  });

  return {
    shortcuts
  };
}

/**
 * Default pymatrix keyboard shortcuts
 * pymatrix默认键盘快捷键配置
 */
export function createDefaultPyMatrixShortcuts(callbacks: {
  onConnectDevice?: () => void;
  onDisconnectAll?: () => void;
  onToggleQuality?: () => void;
  onPauseResume?: () => void;
  onToggleFullscreen?: () => void;
  onRefreshDevices?: () => void;
  onToggleInfo?: () => void;
  onNextDevice?: () => void;
  onPrevDevice?: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  if (callbacks.onConnectDevice) {
    shortcuts.push({
      key: 'n',
      ctrl: true,
      description: 'Connect new device',
      category: 'Device',
      action: callbacks.onConnectDevice
    });
  }

  if (callbacks.onDisconnectAll) {
    shortcuts.push({
      key: 'd',
      ctrl: true,
      shift: true,
      description: 'Disconnect all devices',
      category: 'Device',
      action: callbacks.onDisconnectAll
    });
  }

  if (callbacks.onToggleQuality) {
    shortcuts.push({
      key: 'q',
      ctrl: true,
      description: 'Toggle video quality',
      category: 'Video',
      action: callbacks.onToggleQuality
    });
  }

  if (callbacks.onPauseResume) {
    shortcuts.push({
      key: ' ',
      description: 'Pause/Resume video',
      category: 'Video',
      action: callbacks.onPauseResume
    });
  }

  if (callbacks.onToggleFullscreen) {
    shortcuts.push({
      key: 'f',
      ctrl: true,
      description: 'Toggle fullscreen',
      category: 'Video',
      action: callbacks.onToggleFullscreen
    });
  }

  if (callbacks.onRefreshDevices) {
    shortcuts.push({
      key: 'r',
      ctrl: true,
      description: 'Refresh device list',
      category: 'Device',
      action: callbacks.onRefreshDevices
    });
  }

  if (callbacks.onToggleInfo) {
    shortcuts.push({
      key: 'i',
      ctrl: true,
      description: 'Toggle device info',
      category: 'Device',
      action: callbacks.onToggleInfo
    });
  }

  if (callbacks.onNextDevice) {
    shortcuts.push({
      key: 'ArrowRight',
      ctrl: true,
      description: 'Focus next device',
      category: 'Navigation',
      action: callbacks.onNextDevice
    });
  }

  if (callbacks.onPrevDevice) {
    shortcuts.push({
      key: 'ArrowLeft',
      ctrl: true,
      description: 'Focus previous device',
      category: 'Navigation',
      action: callbacks.onPrevDevice
    });
  }

  return shortcuts;
}
