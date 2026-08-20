/**
 * AI-Web Assist Listener
 *
 * Handles popup messages (type 'ai_web_worker_service') to:
 *   - test:        run an ad-hoc ChatGPT/Gemini web prompt and return the reply
 *                  (+ audio upload result) — the "test on the UI" path.
 *   - start/stop:  one-click enable/disable the Prompt-Translate Web worker that
 *                  fulfils the backend `prompt_translation` task-assist pipeline.
 *   - get_status:  worker run-state + stats for the panel.
 *   - get/set_provider: the preferred web provider (chatgpt | gemini).
 *
 * Mirrors bing-dictionary-client-listener.ts. All actions log through the global
 * logger so the DEBUG center shows them live.
 */
import { promptTranslateWebWorkerService } from './services/prompt-translate-web-worker-service';
import { chatgptWebTool } from './tools/browser/chatgpt-web';
import { geminiWebTool } from './tools/browser/gemini-web';
import { getPreferredProvider, setPreferredProvider } from './tools/browser/ai-web-common';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { logger } from '@/utils/logger';
import { registerRuntimeMessageHandler } from '@/utils/runtime-message';
import { toErrorMessage } from '@/utils/errors';

const LOG = 'AI-Web Listener';

export function initAiWebClientListener(): void {
  registerRuntimeMessageHandler(FEATURE_MESSAGE_TYPES.AI_WEB_WORKER, handleMessage, {
    createErrorResponse: (error) => {
      logger.error(LOG, 'Message handler error', error);
      return { success: false, error: toErrorMessage(error) || 'Unknown error' };
    },
  });
  logger.info(LOG, 'Initialized');
}

async function handleMessage(
  message: { type: string; action: string; provider?: string; prompt?: string; withAudio?: boolean; apiUrl?: string },
): Promise<any> {
  switch (message.action) {
    case 'get_provider': {
      const provider = await getPreferredProvider();
      return { success: true, provider };
    }

    case 'set_provider': {
      const provider = message.provider === 'gemini' ? 'gemini' : 'chatgpt';
      await setPreferredProvider(provider);
      logger.info(LOG, `Preferred web provider set to ${provider}`);
      return { success: true, provider };
    }

    case 'test': {
      const prompt = String(message.prompt || '');
      if (!prompt.trim()) {
        return { success: false, error: 'prompt required' };
      }
      const provider =
        message.provider === 'gemini' || message.provider === 'chatgpt'
          ? message.provider
          : await getPreferredProvider();
      const withAudio = message.withAudio === true;
      logger.info(LOG, `Test via ${provider}: "${prompt.slice(0, 80)}" (audio=${withAudio})`);
      const tool = provider === 'gemini' ? geminiWebTool : chatgptWebTool;
      const result = await tool.execute({ prompt, withAudio });
      const firstContent = result?.content?.[0];
      const resultText = firstContent?.type === 'text' ? firstContent.text : '';
      let parsed: any = {};
      try {
        parsed = JSON.parse(resultText || '{}');
      } catch {
        parsed = {};
      }
      if (result?.isError) {
        const error = parsed?.error || resultText || 'error';
        logger.warn(LOG, `Test failed: ${error}`);
        return { success: false, error };
      }
      logger.info(LOG, `Test ok via ${provider} (audio uploaded=${parsed?.audio?.uploaded ?? 'n/a'})`);
      return { success: true, ...parsed };
    }

    case 'start': {
      const apiUrl = (message.apiUrl || '').trim();
      if (!apiUrl) {
        return { success: false, error: 'apiUrl required' };
      }
      await promptTranslateWebWorkerService.start({
        apiUrl,
        workerName: 'MCP Chrome Prompt-Translate Web Worker',
      });
      logger.info(LOG, 'Prompt-Translate Web worker STARTED — backend task-assist connected');
      return { success: true, message: 'started' };
    }

    case 'stop':
      promptTranslateWebWorkerService.stop();
      logger.info(LOG, 'Prompt-Translate Web worker STOPPED');
      return { success: true, message: 'stopped' };

    case 'get_status': {
      const status = promptTranslateWebWorkerService.getStatus();
      const provider = await getPreferredProvider();
      return { success: true, isRunning: status.isRunning, stats: status.stats, provider };
    }

    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}
