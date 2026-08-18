/**
 * Grok web automation tool (chrome_grok).
 *
 * Page-driving style (like gemini-web.ts / chatgpt-web.ts): reuses the live
 * grok.com tab, injects grok-web-helper.js, and drives it over the
 * ping/submit/peek protocol. Only the async job pair (start/status) is
 * exposed today — used by the popup's Article Study Guide test panel.
 */
import { WebChatJobToolBase, type WebChatJobConfig } from './web-chat-job-base';

const GROK_URL = 'https://grok.com/';
const GROK_HOST = 'grok.com';
const HELPER = 'inject-scripts/grok-web-helper.js';
// Shared human-sim library, co-injected FIRST so the helper can use self.__WebOps.
const WEB_OPS = 'inject-scripts/web-ops.js';

class GrokWebTool extends WebChatJobToolBase {
  name = 'chrome_grok';

  protected jobConfig: WebChatJobConfig = {
    providerLabel: 'Grok Web',
    providerHost: GROK_HOST,
    providerUrl: GROK_URL,
    helperFiles: [WEB_OPS, HELPER],
    submitAction: 'grokSubmitPrompt',
    peekAction: 'grokPeekReply',
    jobsStorageKey: 'grok_text_jobs',
  };
}

export const grokWebTool = new GrokWebTool();
