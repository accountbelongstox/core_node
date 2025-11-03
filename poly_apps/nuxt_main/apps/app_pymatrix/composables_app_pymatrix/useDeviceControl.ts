import { ref } from 'vue';
import { useWSRPC } from '@/composables/useWSRPC';
import type { TouchEvent, KeyEvent, WSRPCMessage } from '@/types/pymatrix';

interface UseDeviceControlOptions {
  deviceSerial: string;
  baseUrl: string;
}

export function useDeviceControl(options: UseDeviceControlOptions) {
  const connected = ref(false);
  const lastAck = ref<any>(null);

  const wsUrl = `${options.baseUrl}/ws/control/${options.deviceSerial}`;

  const { connect: connectWS, disconnect: disconnectWS, sendMessage, connected: wsConnected } = useWSRPC({
    url: wsUrl,
    onMessage: handleMessage,
    onConnect: () => {
      connected.value = true;
    },
    onDisconnect: () => {
      connected.value = false;
    },
    onError: (error) => {
      console.error('Control WebSocket error:', error);
    }
  });

  function handleMessage(message: WSRPCMessage) {
    if (message.type === 'control.connected') {
      console.log('Control connected:', message.data);
    } else if (message.type === 'control.ack') {
      lastAck.value = message.data;
    } else if (message.type === 'error') {
      console.error('Control error:', message.data);
    }
  }

  function sendTouch(
    action: 'down' | 'up' | 'move',
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number
  ) {
    if (!wsConnected.value) {
      return false;
    }

    const touchEvent: TouchEvent = {
      action,
      pointerId: 0,
      x,
      y,
      pressure: 1.0,
      screenWidth,
      screenHeight
    };

    return sendMessage({
      type: 'control.touch',
      timestamp: Date.now(),
      data: touchEvent
    });
  }

  function sendKey(action: 'down' | 'up', keyCode: number) {
    if (!wsConnected.value) {
      return false;
    }

    const keyEvent: KeyEvent = {
      action,
      keyCode,
      metaState: 0
    };

    return sendMessage({
      type: 'control.key',
      timestamp: Date.now(),
      data: keyEvent
    });
  }

  function sendText(text: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'control.text',
      timestamp: Date.now(),
      data: { text }
    });
  }

  function sendSwipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration: number = 300
  ) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'control.swipe',
      timestamp: Date.now(),
      data: {
        x1,
        y1,
        x2,
        y2,
        duration
      }
    });
  }

  function sendSystemKey(action: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down') {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'system',
      timestamp: Date.now(),
      data: { action }
    });
  }

  function sendClipboard(text: string) {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'clipboard.set',
      timestamp: Date.now(),
      data: { text }
    });
  }

  function requestClipboard() {
    if (!wsConnected.value) {
      return false;
    }

    return sendMessage({
      type: 'clipboard.get',
      timestamp: Date.now(),
      data: {}
    });
  }

  function connect() {
    connectWS();
  }

  function disconnect() {
    disconnectWS();
  }

  return {
    connected,
    lastAck,
    connect,
    disconnect,
    sendTouch,
    sendKey,
    sendText,
    sendSwipe,
    sendSystemKey,
    sendClipboard,
    requestClipboard
  };
}
