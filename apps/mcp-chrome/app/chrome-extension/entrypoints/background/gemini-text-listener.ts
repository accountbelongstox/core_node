/**
 * Gemini Text Service Listener
 * Bridges the popup's "Article Study Guide" test panel to geminiWebTool's
 * async start/status job pair. See web-chat-job-listener-factory.ts for the
 * shared message contract (identical across every web-chat provider).
 */
import { geminiWebTool } from './tools/browser/gemini-web';
import { createWebChatJobListener } from './web-chat-job-listener-factory';

export const initGeminiTextListener = createWebChatJobListener('gemini_text_service', geminiWebTool, 'Gemini Web');
