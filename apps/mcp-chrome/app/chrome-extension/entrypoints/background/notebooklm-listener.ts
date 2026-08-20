/**
 * NotebookLM Service Listener
 * Bridges the popup's NotebookLM test panel to the notebookLmTool.
 */

import { notebookLmTool } from './tools/browser/notebooklm';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { registerRuntimeMessageHandler } from '@/utils/runtime-message';
import { toErrorMessage } from '@/utils/errors';

const LOG = 'NotebookLM Listener';

export function initNotebookLMListener() {
  registerRuntimeMessageHandler(FEATURE_MESSAGE_TYPES.NOTEBOOK_LM, async (message: any) => {
    if (message.action !== 'ask') {
      return { success: false, error: `Unknown action: ${message.action}` };
    }
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
    return { success: !result.isError, result: parsed };
  }, {
    createErrorResponse: (error) => {
      logger.error(LOG, 'request failed', error);
      return { success: false, error: toErrorMessage(error) || 'NotebookLM error' };
    },
  });

  logger.info(LOG, 'Initialized');
}
