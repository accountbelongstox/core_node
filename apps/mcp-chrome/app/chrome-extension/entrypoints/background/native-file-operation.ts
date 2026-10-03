import { getNativePort } from './native-host';

const NATIVE_REQUEST_TIMEOUT_MS = 15000;

/**
 * Send a file_operation request over the existing native messaging port and
 * wait for the matching file_operation_response. A dedicated port listener is
 * used because on Firefox the background context never receives its own
 * runtime.sendMessage broadcasts; the port listener works on Chrome too.
 */
export function sendFileOperationRequest(
  payload: Record<string, unknown>,
  timeoutMs: number = NATIVE_REQUEST_TIMEOUT_MS,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const port = getNativePort();
    if (!port) {
      reject(
        new Error(
          'Native messaging host is not connected',
        ),
      );
      return;
    }

    const requestId = `file-operation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const onMessage = (message: any) => {
      if (message?.type !== 'file_operation_response' || message.responseToRequestId !== requestId) {
        return;
      }
      clearTimeout(timer);
      port.onMessage.removeListener(onMessage);
      if (message.error) {
        reject(new Error(String(message.error)));
      } else {
        resolve(message.payload);
      }
    };

    const timer = setTimeout(() => {
      port.onMessage.removeListener(onMessage);
      reject(new Error(`Native file operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    port.onMessage.addListener(onMessage);
    port.postMessage({
      type: 'file_operation',
      requestId,
      payload,
    });
  });
}
