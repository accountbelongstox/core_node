/**
 * Shared background listener factory for web-chat job tools (Gemini, ChatGPT,
 * Grok, Copilot, …). The message contract (type -> {start, status}) is
 * identical across providers, so each provider's listener is just this
 * factory bound to its own message `type` and WebChatJobToolBase instance.
 */
import { logger } from '@/utils/logger';
import { registerRuntimeMessageHandler, toErrorMessage } from '@/utils/runtime-message';

export interface WebChatJobTool {
  start(prompt: string, timeoutMs?: number): Promise<{ ok: boolean; jobId?: string; [key: string]: any }>;
  status(jobId: string): Promise<{ ok: boolean; status: string; [key: string]: any }>;
}

export function createWebChatJobListener(messageType: string, tool: WebChatJobTool, label: string): () => void {
  return function init(): void {
    registerRuntimeMessageHandler(messageType, async (message: any) => {
      if (message.action === 'start') {
        const result = await tool.start(String(message.prompt || ''), message.timeoutMs || 180000);
        return { success: result.ok, result };
      }
      if (message.action === 'status') {
        const result = await tool.status(String(message.jobId || ''));
        return { success: result.status !== 'unknown', result };
      }
      return { success: false, error: `Unknown action: ${message.action}` };
    }, {
      createErrorResponse: (error) => {
        logger.error(label, 'request failed', error);
        return {
          success: false,
          error: toErrorMessage(error) || `${label} error`,
        };
      },
    });

    logger.info(label, 'Initialized');
  };
}
