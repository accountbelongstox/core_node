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

    // ✅ REMOVED outer try-catch for debugging - let errors surface
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
        // ✅ REMOVED try-catch for debugging - let errors surface
        const message: WSRPCMessage = JSON.parse(event.data);
        options.onMessage?.(message);
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

    // ✅ REMOVED try-catch for debugging - let errors surface
    ws.value.send(JSON.stringify(message));
    return true;
  };

  const sendBinary = (data: ArrayBuffer) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return false;
    }

    // ✅ REMOVED try-catch for debugging - let errors surface
    ws.value.send(data);
    return true;
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
