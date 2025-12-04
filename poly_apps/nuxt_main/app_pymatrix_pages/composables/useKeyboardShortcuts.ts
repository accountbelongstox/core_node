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
 *
 * ⚠️ IMPORTANT: Using Alt key combinations to avoid conflicts with browser/system shortcuts
 * - Ctrl+N = New window (browser)
 * - Ctrl+R = Refresh (browser)
 * - Ctrl+F = Find (browser)
 * - Ctrl+Q = Quit (browser)
 * - Ctrl+I = Developer tools (browser)
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
  onScreenshot?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  if (callbacks.onConnectDevice) {
    shortcuts.push({
      key: 'n',
      alt: true,
      description: 'Connect new device',
      category: 'Device',
      action: callbacks.onConnectDevice
    });
  }

  if (callbacks.onDisconnectAll) {
    shortcuts.push({
      key: 'd',
      alt: true,
      shift: true,
      description: 'Disconnect all devices',
      category: 'Device',
      action: callbacks.onDisconnectAll
    });
  }

  if (callbacks.onToggleQuality) {
    shortcuts.push({
      key: 'q',
      alt: true,
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
      alt: true,
      description: 'Toggle fullscreen',
      category: 'Video',
      action: callbacks.onToggleFullscreen
    });
  }

  if (callbacks.onRefreshDevices) {
    shortcuts.push({
      key: 'r',
      alt: true,
      description: 'Refresh device list',
      category: 'Device',
      action: callbacks.onRefreshDevices
    });
  }

  if (callbacks.onToggleInfo) {
    shortcuts.push({
      key: 'i',
      alt: true,
      description: 'Toggle device info',
      category: 'Device',
      action: callbacks.onToggleInfo
    });
  }

  if (callbacks.onNextDevice) {
    shortcuts.push({
      key: 'ArrowRight',
      alt: true,
      description: 'Focus next device',
      category: 'Navigation',
      action: callbacks.onNextDevice
    });
  }

  if (callbacks.onPrevDevice) {
    shortcuts.push({
      key: 'ArrowLeft',
      alt: true,
      description: 'Focus previous device',
      category: 'Navigation',
      action: callbacks.onPrevDevice
    });
  }

  // New shortcuts for recording
  if (callbacks.onScreenshot) {
    shortcuts.push({
      key: 's',
      alt: true,
      description: 'Take screenshot',
      category: 'Recording',
      action: callbacks.onScreenshot
    });
  }

  if (callbacks.onStartRecording) {
    shortcuts.push({
      key: 'r',
      alt: true,
      shift: true,
      description: 'Start recording',
      category: 'Recording',
      action: callbacks.onStartRecording
    });
  }

  if (callbacks.onStopRecording) {
    shortcuts.push({
      key: 'x',
      alt: true,
      description: 'Stop recording',
      category: 'Recording',
      action: callbacks.onStopRecording
    });
  }

  return shortcuts;
}
