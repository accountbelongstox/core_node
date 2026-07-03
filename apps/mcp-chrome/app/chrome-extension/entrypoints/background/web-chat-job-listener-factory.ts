/**
 * Shared background listener factory for web-chat job tools (Gemini, ChatGPT,
 * Grok, Copilot, …). The message contract (type -> {start, status}) is
 * identical across providers, so each provider's listener is just this
 * factory bound to its own message `type` and WebChatJobToolBase instance.
 */
import { logger } from '@/utils/logger';

export interface WebChatJobTool {
  start(prompt: string, timeoutMs?: number): Promise<{ ok: boolean; jobId?: string; [key: string]: any }>;
  status(jobId: string): Promise<{ ok: boolean; status: string; [key: string]: any }>;
}

export function createWebChatJobListener(messageType: string, tool: WebChatJobTool, label: string): () => void {
  return function init(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== messageType) return;

      (async () => {
        try {
          if (message.action === 'start') {
            const result = await tool.start(String(message.prompt || ''), message.timeoutMs || 180000);
            sendResponse({ success: result.ok, result });
          } else if (message.action === 'status') {
            const result = await tool.status(String(message.jobId || ''));
            sendResponse({ success: result.status !== 'unknown', result });
          } else {
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
          }
        } catch (error: any) {
          logger.error(label, 'request failed', error);
          sendResponse({ success: false, error: error?.message || `${label} error` });
        }
      })();

      return true; // async response
    });

    logger.info(label, 'Initialized');
  };
}
