import { ref, onUnmounted } from 'vue';
import type { WSRPCMessage } from '../types/pymatrix';

interface UseWSRPCOptions {
  url: string;
  onMessage?: (message: WSRPCMessage) => void;
  onBinaryMessage?: (data: ArrayBuffer) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWSRPC(options: UseWSRPCOptions) {
  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);
  const connecting = ref(false);
  const lastError = ref<string | null>(null);

  const connect = () => {
    if (connecting.value || (ws.value && ws.value.readyState === WebSocket.OPEN)) {
      return;
    }

    connecting.value = true;
    lastError.value = null;

    try {
      ws.value = new WebSocket(options.url);
      ws.value.binaryType = 'arraybuffer';

      ws.value.onopen = () => {
        connected.value = true;
        connecting.value = false;
        options.onConnect?.();
      };

      ws.value.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          options.onBinaryMessage?.(event.data);
        } else if (typeof event.data === 'string') {
          try {
            const message: WSRPCMessage = JSON.parse(event.data);
            options.onMessage?.(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        }
      };

      ws.value.onerror = (error) => {
        lastError.value = 'WebSocket error occurred';
        options.onError?.(error);
      };

      ws.value.onclose = () => {
        connected.value = false;
        connecting.value = false;
        options.onDisconnect?.();
      };
    } catch (error) {
      connecting.value = false;
      lastError.value = error instanceof Error ? error.message : 'Connection failed';
      console.error('Failed to create WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    connected.value = false;
    connecting.value = false;
  };

  const sendMessage = (message: WSRPCMessage) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return false;
    }

    try {
      ws.value.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  };

  const sendBinary = (data: ArrayBuffer) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return false;
    }

    try {
      ws.value.send(data);
      return true;
    } catch (error) {
      console.error('Failed to send binary data:', error);
      return false;
    }
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    connected,
    connecting,
    lastError,
    connect,
    disconnect,
    sendMessage,
    sendBinary
  };
}
