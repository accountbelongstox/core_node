/**
 * Grok Text Service Listener
 * Bridges the popup's "Article Study Guide" test panel to grokWebTool's
 * async start/status job pair. See web-chat-job-listener-factory.ts for the
 * shared message contract (identical across every web-chat provider).
 */
import { grokWebTool } from './tools/browser/grok-web';
import { createWebChatJobListener } from './web-chat-job-listener-factory';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

export const initGrokTextListener = createWebChatJobListener(FEATURE_MESSAGE_TYPES.GROK_TEXT, grokWebTool, 'Grok Web');
