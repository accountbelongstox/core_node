/**
 * Copilot Text Service Listener
 * Bridges the popup's "Article Study Guide" test panel to copilotWebTool's
 * async start/status job pair. See web-chat-job-listener-factory.ts for the
 * shared message contract (identical across every web-chat provider).
 */
import { copilotWebTool } from './tools/browser/copilot-web';
import { createWebChatJobListener } from './web-chat-job-listener-factory';

export const initCopilotTextListener = createWebChatJobListener('copilot_text_service', copilotWebTool, 'Copilot Web');
