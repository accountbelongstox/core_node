/**
 * Gemini Image Service Listener
 * Bridges the popup's "Generate image (Gemini)" button to the geminiImageTool.
 * One click -> open/reuse a Gemini tab -> generate an image -> return the binary
 * as a base64 data URL.
 */

import { geminiImageTool } from './tools/browser/gemini-image';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { registerRuntimeMessageHandler, toErrorMessage } from '@/utils/runtime-message';

const LOG = 'Gemini Listener';

export function initGeminiImageListener() {
  registerRuntimeMessageHandler(FEATURE_MESSAGE_TYPES.GEMINI_IMAGE, async (message: any) => {
    if (message.action === 'start') {
      const result = await geminiImageTool.start(
        String(message.prompt || ''),
        !!message.openInNewTab,
        message.timeoutMs || 120000,
      );
      return { success: result.ok, result };
    }
    if (message.action === 'status') {
      const result = await geminiImageTool.status(String(message.jobId || ''));
      return { success: result.status !== 'unknown', result };
    }
    return { success: false, error: `Unknown action: ${message.action}` };
  }, {
    createErrorResponse: (error) => {
      logger.error(LOG, 'request failed', error);
      return { success: false, error: toErrorMessage(error) || 'Gemini image error' };
    },
  });

  logger.info(LOG, 'Initialized');
}
