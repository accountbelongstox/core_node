/**
 * NotebookLM Service Listener
 * Bridges the popup's NotebookLM test panel to the notebookLmTool.
 */

import { notebookLmTool } from './tools/browser/notebooklm';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

const LOG = 'NotebookLM Listener';

export function initNotebookLMListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== FEATURE_MESSAGE_TYPES.NOTEBOOK_LM) return;

    (async () => {
      try {
        if (message.action === 'ask') {
          const result = await notebookLmTool.execute({
            question: message.question || '',
            notebookUrl: message.notebookUrl || undefined,
            timeoutMs: message.timeoutMs || 60000,
          });
          const first = result.content?.[0] as any;
          const text = first?.text;
          let parsed: any = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { answer: text };
          }
          sendResponse({ success: !result.isError, result: parsed });
        } else {
          sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (error: any) {
        logger.error(LOG, 'request failed', error);
        sendResponse({ success: false, error: error?.message || 'NotebookLM error' });
      }
    })();

    return true; // async response
  });

  logger.info(LOG, 'Initialized');
}
