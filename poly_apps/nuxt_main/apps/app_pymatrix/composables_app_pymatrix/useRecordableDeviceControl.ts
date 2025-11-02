import { useDeviceControl } from './useDeviceControl';
import { useScriptRecorder } from './useScriptRecorder';
import type { Device } from '../../../types/pymatrix';

interface UseRecordableDeviceControlOptions {
  deviceSerial: string;
  baseUrl: string;
  enableRecording?: boolean;
}

/**
 * Recordable Device Control Composable
 *
 * Wraps useDeviceControl and automatically records actions when recording is active.
 * This provides a transparent recording layer over normal device control operations.
 */
export function useRecordableDeviceControl(options: UseRecordableDeviceControlOptions) {
  const deviceControl = useDeviceControl({
    deviceSerial: options.deviceSerial,
    baseUrl: options.baseUrl
  });

  const recorder = useScriptRecorder();

  /**
   * Send touch action and record if recording is active
   */
  function sendTouch(
    action: 'down' | 'up' | 'move',
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number
  ) {
    const success = deviceControl.sendTouch(action, x, y, screenWidth, screenHeight);

    if (success && options.enableRecording !== false) {
      // Convert basic touch actions to tap or long_press for recording
      if (action === 'down') {
        // Record as tap for now, can be upgraded to long_press if held
        recorder.recordTouch('tap', x, y);
      }
    }

    return success;
  }

  /**
   * Send tap action (convenience method)
   */
  function sendTap(x: number, y: number, screenWidth: number, screenHeight: number) {
    const downSuccess = deviceControl.sendTouch('down', x, y, screenWidth, screenHeight);
    setTimeout(() => {
      deviceControl.sendTouch('up', x, y, screenWidth, screenHeight);
    }, 50);

    if (downSuccess && options.enableRecording !== false) {
      recorder.recordTouch('tap', x, y);
    }

    return downSuccess;
  }

  /**
   * Send long press action (convenience method)
   */
  function sendLongPress(
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    duration: number = 1000
  ) {
    const downSuccess = deviceControl.sendTouch('down', x, y, screenWidth, screenHeight);
    setTimeout(() => {
      deviceControl.sendTouch('up', x, y, screenWidth, screenHeight);
    }, duration);

    if (downSuccess && options.enableRecording !== false) {
      recorder.recordTouch('long_press', x, y, duration);
    }

    return downSuccess;
  }

  /**
   * Send key event and record if recording is active
   */
  function sendKey(action: 'down' | 'up', keyCode: number, keyName?: string) {
    const success = deviceControl.sendKey(action, keyCode);

    if (success && action === 'down' && options.enableRecording !== false) {
      recorder.recordKey('down', keyCode, keyName || `Key ${keyCode}`);
    }

    return success;
  }

  /**
   * Send text input and record if recording is active
   */
  function sendText(text: string) {
    const success = deviceControl.sendText(text);

    if (success && options.enableRecording !== false) {
      recorder.recordText(text);
    }

    return success;
  }

  /**
   * Send swipe gesture and record if recording is active
   */
  function sendSwipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration: number = 300
  ) {
    const success = deviceControl.sendSwipe(x1, y1, x2, y2, duration);

    if (success && options.enableRecording !== false) {
      recorder.recordSwipe(x1, y1, x2, y2, duration);
    }

    return success;
  }

  /**
   * Send system key and record if recording is active
   */
  function sendSystemKey(action: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down') {
    const success = deviceControl.sendSystemKey(action);

    if (success && options.enableRecording !== false) {
      recorder.recordSystemKey(action);
    }

    return success;
  }

  /**
   * Send clipboard text and record if recording is active
   */
  function sendClipboard(text: string) {
    const success = deviceControl.sendClipboard(text);

    if (success && options.enableRecording !== false) {
      recorder.recordClipboard('set', text);
    }

    return success;
  }

  /**
   * Request clipboard content and record if recording is active
   */
  function requestClipboard() {
    const success = deviceControl.requestClipboard();

    if (success && options.enableRecording !== false) {
      recorder.recordClipboard('get');
    }

    return success;
  }

  /**
   * Record a wait step (doesn't send anything to device)
   */
  function recordWait(duration: number) {
    if (options.enableRecording !== false) {
      recorder.recordWait(duration);
    }
  }

  /**
   * Record a screenshot step (doesn't send anything to device)
   */
  function recordScreenshot(format: 'png' | 'jpg' = 'png') {
    if (options.enableRecording !== false) {
      recorder.recordScreenshot(format);
    }
  }

  return {
    // Device control state
    connected: deviceControl.connected,
    lastAck: deviceControl.lastAck,

    // Connection management
    connect: deviceControl.connect,
    disconnect: deviceControl.disconnect,

    // Control actions (with automatic recording)
    sendTouch,
    sendTap,
    sendLongPress,
    sendKey,
    sendText,
    sendSwipe,
    sendSystemKey,
    sendClipboard,
    requestClipboard,

    // Recording-only actions
    recordWait,
    recordScreenshot,

    // Recording state and controls
    isRecording: recorder.isRecording,
    recordingStats: recorder.recordingStats
  };
}
