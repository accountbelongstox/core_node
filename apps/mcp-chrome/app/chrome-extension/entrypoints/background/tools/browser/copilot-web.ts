/**
 * Microsoft Copilot web automation tool (chrome_copilot).
 *
 * Page-driving style (like gemini-web.ts / chatgpt-web.ts): reuses the live
 * copilot.microsoft.com tab, injects copilot-web-helper.js, and drives it
 * over the ping/submit/peek protocol. Copilot sometimes renders a long
 * structured reply as a separate "canvas" page instead of inline chat text —
 * copilot-web-helper.js's peekReply detects the "…Open page" trigger,
 * human-clicks it, and reads the resulting page; that is entirely a
 * content-script concern, so this class needs no special-casing beyond the
 * shared job config.
 */
import { WebChatJobToolBase, type WebChatJobConfig } from './web-chat-job-base';

const COPILOT_URL = 'https://copilot.microsoft.com/';
const COPILOT_HOST = 'copilot.microsoft.com';
const HELPER = 'inject-scripts/copilot-web-helper.js';
// Shared human-sim library, co-injected FIRST so the helper can use self.__WebOps
// (humanClick — used to open the canvas "…Open page" card like a real user).
const WEB_OPS = 'inject-scripts/web-ops.js';

class CopilotWebTool extends WebChatJobToolBase {
  name = 'chrome_copilot';

  protected jobConfig: WebChatJobConfig = {
    providerLabel: 'Copilot Web',
    providerHost: COPILOT_HOST,
    providerUrl: COPILOT_URL,
    helperFiles: [WEB_OPS, HELPER],
    submitAction: 'copilotSubmitPrompt',
    peekAction: 'copilotPeekReply',
    jobsStorageKey: 'copilot_text_jobs',
    // The provider tab is reused across jobs; closing the canvas page once its
    // content has been extracted keeps a later job from ever having to reason
    // about a stale page left open by this one.
    cleanupAction: 'copilotClosePage',
  };
}

export const copilotWebTool = new CopilotWebTool();
