import { toErrorMessage } from './errors';

export { toErrorMessage } from './errors';

export type RuntimeSendResponse = (response?: any) => void;
export type RuntimeMessageHandler<TMessage, TResponse> = (
  message: TMessage,
  sender: chrome.runtime.MessageSender,
) => TResponse | Promise<TResponse>;

export interface RuntimeMessageHandlerOptions<TMessage> {
  createErrorResponse?: (error: unknown, message: TMessage) => any;
}

export function respondAsync<T>(
  sendResponse: RuntimeSendResponse,
  promise: Promise<T>,
  createSuccessResponse?: (result: T) => any,
  createErrorResponse?: (error: unknown) => any,
): true {
  promise
    .then((result) => sendResponse(createSuccessResponse ? createSuccessResponse(result) : result))
    .catch((error) => sendResponse(
      createErrorResponse
        ? createErrorResponse(error)
        : { success: false, error: toErrorMessage(error) },
    ));
  return true;
}

export function registerRuntimeMessageHandler<
  TMessage extends { type?: string },
  TResponse,
>(
  messageTypes: string | readonly string[],
  handler: RuntimeMessageHandler<TMessage, TResponse>,
  options: RuntimeMessageHandlerOptions<TMessage> = {},
): () => void {
  const createErrorResponse = options.createErrorResponse;
  const acceptedTypes = new Set(
    typeof messageTypes === 'string' ? [messageTypes] : messageTypes,
  );
  const listener = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: RuntimeSendResponse,
  ): boolean => {
    const typedMessage = message as TMessage;
    if (!typedMessage?.type || !acceptedTypes.has(typedMessage.type)) return false;
    return respondAsync(
      sendResponse,
      Promise.resolve().then(() => handler(typedMessage, sender)),
      undefined,
      createErrorResponse
        ? (error) => createErrorResponse(error, typedMessage)
        : undefined,
    );
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
