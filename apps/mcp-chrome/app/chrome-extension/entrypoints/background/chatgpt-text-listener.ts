/**
 * ChatGPT Text Service Listener
 * Bridges the popup's "Article Study Guide" test panel to chatgptWebTool's
 * async start/status job pair. See web-chat-job-listener-factory.ts for the
 * shared message contract (identical across every web-chat provider).
 */
import { chatgptWebTool } from './tools/browser/chatgpt-web';
import { createWebChatJobListener } from './web-chat-job-listener-factory';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

export const initChatGptTextListener = createWebChatJobListener(FEATURE_MESSAGE_TYPES.CHATGPT_TEXT, chatgptWebTool, 'ChatGPT Web');
