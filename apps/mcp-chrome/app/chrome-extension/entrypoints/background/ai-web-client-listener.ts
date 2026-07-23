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

const LOG = 'AI-Web Listener';

export function initAiWebClientListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === FEATURE_MESSAGE_TYPES.AI_WEB_WORKER) {
      handleMessage(message, sendResponse);
      return true; // async response
    }
  });
  logger.info(LOG, 'Initialized');
}

async function handleMessage(
  message: { type: string; action: string; provider?: string; prompt?: string; withAudio?: boolean; apiUrl?: string },
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    switch (message.action) {
      case 'get_provider': {
        const provider = await getPreferredProvider();
        sendResponse({ success: true, provider });
        break;
      }

      case 'set_provider': {
        const provider = message.provider === 'gemini' ? 'gemini' : 'chatgpt';
        await setPreferredProvider(provider);
        logger.info(LOG, `Preferred web provider set to ${provider}`);
        sendResponse({ success: true, provider });
        break;
      }

      case 'test': {
        const prompt = String(message.prompt || '');
        if (!prompt.trim()) {
          sendResponse({ success: false, error: 'prompt required' });
          break;
        }
        const provider =
          message.provider === 'gemini' || message.provider === 'chatgpt'
            ? message.provider
            : await getPreferredProvider();
        const withAudio = message.withAudio === true;
        logger.info(LOG, `Test via ${provider}: "${prompt.slice(0, 80)}" (audio=${withAudio})`);
        const tool = provider === 'gemini' ? geminiWebTool : chatgptWebTool;
        const result = await tool.execute({ prompt, withAudio });
        let parsed: any = {};
        try {
          parsed = JSON.parse(result?.content?.[0]?.text || '{}');
        } catch {
          parsed = {};
        }
        if (result?.isError) {
          logger.warn(LOG, `Test failed: ${parsed?.error || result?.content?.[0]?.text || 'error'}`);
          sendResponse({ success: false, error: parsed?.error || result?.content?.[0]?.text || 'error' });
        } else {
          logger.info(LOG, `Test ok via ${provider} (audio uploaded=${parsed?.audio?.uploaded ?? 'n/a'})`);
          sendResponse({ success: true, ...parsed });
        }
        break;
      }

      case 'start': {
        const apiUrl = (message.apiUrl || '').trim();
        if (!apiUrl) {
          sendResponse({ success: false, error: 'apiUrl required' });
          break;
        }
        await promptTranslateWebWorkerService.start({
          apiUrl,
          workerName: 'MCP Chrome Prompt-Translate Web Worker',
        });
        logger.info(LOG, 'Prompt-Translate Web worker STARTED — backend task-assist connected');
        sendResponse({ success: true, message: 'started' });
        break;
      }

      case 'stop': {
        promptTranslateWebWorkerService.stop();
        logger.info(LOG, 'Prompt-Translate Web worker STOPPED');
        sendResponse({ success: true, message: 'stopped' });
        break;
      }

      case 'get_status': {
        const status = promptTranslateWebWorkerService.getStatus();
        const provider = await getPreferredProvider();
        sendResponse({ success: true, isRunning: status.isRunning, stats: status.stats, provider });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
    }
  } catch (error: any) {
    logger.error(LOG, 'Message handler error', error);
    sendResponse({ success: false, error: error?.message || 'Unknown error' });
  }
}
