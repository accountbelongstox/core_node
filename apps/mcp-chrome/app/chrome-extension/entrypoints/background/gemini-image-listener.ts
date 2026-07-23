/**
 * Gemini Image Service Listener
 * Bridges the popup's "Generate image (Gemini)" button to the geminiImageTool.
 * One click -> open/reuse a Gemini tab -> generate an image -> return the binary
 * as a base64 data URL.
 */

import { geminiImageTool } from './tools/browser/gemini-image';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

const LOG = 'Gemini Listener';

export function initGeminiImageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== FEATURE_MESSAGE_TYPES.GEMINI_IMAGE) return;

    (async () => {
      try {
        if (message.action === 'start') {
          const result = await geminiImageTool.start(
            String(message.prompt || ''),
            !!message.openInNewTab,
            message.timeoutMs || 120000,
          );
          sendResponse({ success: result.ok, result });
        } else if (message.action === 'status') {
          const result = await geminiImageTool.status(String(message.jobId || ''));
          // success = "we got a usable status" (the popup reads result.status).
          sendResponse({ success: result.status !== 'unknown', result });
        } else {
          sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (error: any) {
        logger.error(LOG, 'request failed', error);
        sendResponse({ success: false, error: error?.message || 'Gemini image error' });
      }
    })();

    return true; // async response
  });

  logger.info(LOG, 'Initialized');
}
