/**
 * Copilot Text Service Listener
 * Bridges the popup's "Article Study Guide" test panel to copilotWebTool's
 * async start/status job pair. See web-chat-job-listener-factory.ts for the
 * shared message contract (identical across every web-chat provider).
 */
import { copilotWebTool } from './tools/browser/copilot-web';
import { createWebChatJobListener } from './web-chat-job-listener-factory';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

export const initCopilotTextListener = createWebChatJobListener(FEATURE_MESSAGE_TYPES.COPILOT_TEXT, copilotWebTool, 'Copilot Web');
