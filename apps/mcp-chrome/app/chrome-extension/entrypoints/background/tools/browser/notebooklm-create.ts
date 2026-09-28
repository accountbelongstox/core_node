import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import { waitForTabComplete } from '@/utils/tab-readiness';
import { SessionJobStore } from '@/utils/session-job-store';

// Literal name (mirrored in chrome-mcp-shared TOOL_NAMES.BROWSER.NOTEBOOKLM_CREATE).
const TOOL_NAME = 'chrome_notebooklm_create';
const NBLM_HOME = 'https://notebooklm.google.com/';
const HELPER = 'inject-scripts/notebooklm-create-helper.js';
const LOG = 'NotebookLM Create';
const JOBS_KEY = 'nblm_create_jobs';

export type NblmJobStatus = 'creating' | 'generating' | 'done' | 'failed';

export interface NblmJob {
  jobId: string;
  tabId: number;
  text: string;
  status: NblmJobStatus;
  deadline: number;
  notebookUrl?: string | null;
  title?: string | null;
  sourceCount?: number;
  error?: string | null;
}

interface NblmParams {
  action?: 'start' | 'status';
  text?: string;
  jobId?: string;
  openInNewTab?: boolean;
  timeoutMs?: number;
}

/**
 * Create a NotebookLM notebook from a text/topic prompt and start generation —
 * ASYNC two-phase so neither the MCP client nor the bridge times out:
 *   action:"start" {text}   -> open NotebookLM, click "Create new", wait for the
 *                              new notebook, add the text source + submit;
 *                              returns {jobId, notebookUrl} fast.
 *   action:"status" {jobId} -> re-inspect the notebook tab; done/generating/failed.
 *
 * NotebookLM is a Shadow-DOM SPA, so the DOM work lives in the injected helper
 * (shadow-piercing, text-matching). Requires an authenticated Google session.
 */
class NotebookLMCreateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAME;
  private readonly jobStore = new SessionJobStore<NblmJob>(JOBS_KEY);

  async execute(args: NblmParams): Promise<ToolResult> {
    const action = args?.action || (args?.jobId ? 'status' : 'start');
    try {
      if (action === 'status') {
        const jobId = String(args?.jobId || '');
        if (!jobId) return createErrorResponse("jobId is required for action='status'");
        const r = await this.status(jobId);
        return createJsonResponse({ jobId, ...r }, {
          isError: r.status === 'failed' || r.status === 'unknown',
          space: 2,
        });
      }
      const text = (args?.text || '').trim();
      if (!text) return createErrorResponse('text is required to start a notebook');
      const r = await this.start(text, !!args?.openInNewTab, args?.timeoutMs ?? 180000);
      return createJsonResponse(r, { isError: !r.ok, space: 2 });
    } catch (error) {
      return createErrorResponse(
        `NotebookLM create error: ${toErrorMessage(error)}`,
      );
    }
  }

  /** Phase 1: create the notebook + submit the text source. Returns fast. */
  async start(
    text: string,
    openInNewTab = false,
    timeoutMs = 180000,
  ): Promise<{
    ok: boolean;
    jobId?: string;
    tabId?: number;
    notebookUrl?: string | null;
    status?: NblmJobStatus;
    error?: string;
    hint?: string;
  }> {
    const tab = await this.resolveTab(openInNewTab);
    if (!tab?.id) return { ok: false, error: 'Failed to open or find a NotebookLM tab' };
    const tabId = tab.id;

    // Land on the app home, then click "Create new" (the real create action;
    // navigating to /notebook/creating directly just spins forever).
    await this.ensureOnHome(tabId);
    await this.injectContentScript(tabId, [HELPER]);
    await delay(400);
    const created = await this.sendMessageToTab(tabId, { action: 'nblmClickCreate' }).catch((e: any) => ({
      clicked: false,
      error: String(e?.message || e),
    }));
    if (!created || !created.clicked) {
      return { ok: false, tabId, error: (created && created.error) || 'Could not click "Create new"' };
    }

    // Wait for the redirect to the new notebook (/notebook/<id>), past /creating.
    const notebookUrl = await this.waitForNotebookUrl(tabId, 30000);
    if (!notebookUrl) {
      return { ok: false, tabId, error: 'Timed out waiting for the new notebook to open' };
    }

    // Add the text/topic source and submit on the new notebook page.
    await this.injectContentScript(tabId, [HELPER]);
    await delay(500);
    const added = await this.sendMessageToTab(tabId, { action: 'nblmAddSourceText', text }).catch((e: any) => ({
      submitted: false,
      error: String(e?.message || e),
    }));
    if (!added || !added.submitted) {
      return {
        ok: false,
        tabId,
        notebookUrl,
        error: (added && added.error) || 'Could not submit the text source',
      };
    }

    const jobId = this.genId();
    this.jobStore.set({
      jobId,
      tabId,
      text,
      status: 'generating',
      deadline: Date.now() + Math.max(30000, timeoutMs),
      notebookUrl,
    });
    await this.jobStore.persist();
    logger.info(LOG, `Started job ${jobId} (${notebookUrl}) via ${added.via || '?'}`);
    return {
      ok: true,
      jobId,
      tabId,
      notebookUrl,
      status: 'generating',
      hint: "Poll with action='status' and this jobId until status is 'done' or 'failed'.",
    };
  }

  /** Phase 2: re-inspect the notebook tab; resolve done/generating/failed. */
  async status(jobId: string): Promise<{
    ok: boolean;
    status: NblmJobStatus | 'unknown';
    generating?: boolean;
    notebookUrl?: string | null;
    title?: string | null;
    sourceCount?: number;
    error?: string;
  }> {
    let job = this.jobStore.get(jobId);
    if (!job) job = await this.jobStore.hydrate(jobId);
    if (!job) return { ok: false, status: 'unknown', error: 'Unknown jobId (expired or never started)' };
    if (job.status === 'done') {
      return { ok: true, status: 'done', notebookUrl: job.notebookUrl, title: job.title, sourceCount: job.sourceCount };
    }
    try {
      await this.injectContentScript(job.tabId, [HELPER]);
      const r = await this.sendMessageToTab(job.tabId, { action: 'nblmStatus' });
      if (r && r.ready && !r.generating) {
        job.status = 'done';
        job.title = r.title;
        job.sourceCount = r.sourceCount;
        await this.jobStore.persist();
        logger.info(LOG, `Job ${jobId} done (${r.sourceCount} sources)`);
        return { ok: true, status: 'done', notebookUrl: job.notebookUrl, title: r.title, sourceCount: r.sourceCount };
      }
      if (Date.now() > job.deadline) {
        job.status = 'failed';
        job.error = 'Timed out waiting for the notebook to finish generating';
        await this.jobStore.persist();
        return { ok: false, status: 'failed', error: job.error, notebookUrl: job.notebookUrl };
      }
      return { ok: true, status: 'generating', generating: !!(r && r.generating), notebookUrl: job.notebookUrl };
    } catch (error: any) {
      if (Date.now() > job.deadline) {
        const msg = error?.message || 'NotebookLM tab unreachable';
        job.status = 'failed';
        job.error = msg;
        await this.jobStore.persist();
        return { ok: false, status: 'failed', error: msg };
      }
      return { ok: true, status: 'generating', generating: true, notebookUrl: job.notebookUrl };
    }
  }

  // ------------------------------------------------------------------

  private genId(): string {
    return `nb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async ensureOnHome(tabId: number): Promise<void> {
    const tab = await this.tryGetTab(tabId);
    // Land on the app home unless we're already somewhere on notebooklm.google.com.
    if (!tab || !tab.url || !tab.url.includes('notebooklm.google.com')) {
      await chrome.tabs.update(tabId, { url: NBLM_HOME });
    }
    await waitForTabComplete(tabId, {
      timeoutMs: 25000,
      settleDelayMs: 700,
      statusProbeDelayMs: 800,
    });
  }

  private async resolveTab(openInNewTab: boolean): Promise<chrome.tabs.Tab | undefined> {
    if (!openInNewTab) {
      const all = await chrome.tabs.query({});
      const tab = all.find((t) => t.url && t.url.includes('notebooklm.google.com'));
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true });
        return tab;
      }
    }
    return chrome.tabs.create({ url: NBLM_HOME, active: true });
  }

  /** Poll the tab URL until it is a real notebook (/notebook/<id>, not /creating). */
  private async waitForNotebookUrl(tabId: number, timeoutMs: number): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await delay(1000);
      const tab = await this.tryGetTab(tabId);
      const url = tab?.url || '';
      if (/\/notebook\/[0-9a-f-]{8,}/i.test(url)) {
        // Give the add-source UI a moment to render.
        await delay(1200);
        return url;
      }
    }
    return null;
  }

}

export const notebookLmCreateTool = new NotebookLMCreateTool();
