import { getQwenTtsProgress, runQwenTts } from './services/qwen-tts-service';
import { logger } from '@/utils/logger';

const LOG = 'Qwen TTS Listener';

export function initQwenTtsListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'qwen_tts') return false;

    (async () => {
      try {
        switch (message.action) {
          case 'generate': {
            const result = await runQwenTts(message.request || {});
            sendResponse({ success: result.ok, result });
            break;
          }
          case 'get_status':
            sendResponse({ success: true, progress: await getQwenTtsProgress() });
            break;
          default:
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error(LOG, error, err);
        sendResponse({ success: false, error });
      }
    })();

    return true;
  });

  logger.info(LOG, 'Initialized');
}
