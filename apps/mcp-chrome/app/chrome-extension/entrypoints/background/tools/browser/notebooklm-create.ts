import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';

// Literal name (mirrored in chrome-mcp-shared TOOL_NAMES.BROWSER.NOTEBOOKLM_CREATE).
const TOOL_NAME = 'chrome_notebooklm_create';
const NBLM_HOME = 'https://notebooklm.google.com/';
const HELPER = 'inject-scripts/notebooklm-create-helper.js';
const LOG = 'NotebookLM Create';
const JOBS_KEY = 'nblm_create_jobs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  private jobs = new Map<string, NblmJob>();

  async execute(args: NblmParams): Promise<ToolResult> {
    const action = args?.action || (args?.jobId ? 'status' : 'start');
    try {
      if (action === 'status') {
        const jobId = String(args?.jobId || '');
        if (!jobId) return createErrorResponse("jobId is required for action='status'");
        const r = await this.status(jobId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ jobId, ...r }, null, 2) }],
          isError: r.status === 'failed' || r.status === 'unknown',
        };
      }
      const text = (args?.text || '').trim();
      if (!text) return createErrorResponse('text is required to start a notebook');
      const r = await this.start(text, !!args?.openInNewTab, args?.timeoutMs ?? 180000);
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    } catch (error) {
      return createErrorResponse(
        `NotebookLM create error: ${error instanceof Error ? error.message : String(error)}`,
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
    await sleep(400);
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
    await sleep(500);
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
    this.jobs.set(jobId, {
      jobId,
      tabId,
      text,
      status: 'generating',
      deadline: Date.now() + Math.max(30000, timeoutMs),
      notebookUrl,
    });
    await this.persist();
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
    let job = this.jobs.get(jobId);
    if (!job) job = await this.hydrate(jobId);
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
        await this.persist();
        logger.info(LOG, `Job ${jobId} done (${r.sourceCount} sources)`);
        return { ok: true, status: 'done', notebookUrl: job.notebookUrl, title: r.title, sourceCount: r.sourceCount };
      }
      if (Date.now() > job.deadline) {
        job.status = 'failed';
        job.error = 'Timed out waiting for the notebook to finish generating';
        await this.persist();
        return { ok: false, status: 'failed', error: job.error, notebookUrl: job.notebookUrl };
      }
      return { ok: true, status: 'generating', generating: !!(r && r.generating), notebookUrl: job.notebookUrl };
    } catch (error: any) {
      if (Date.now() > job.deadline) {
        const msg = error?.message || 'NotebookLM tab unreachable';
        job.status = 'failed';
        job.error = msg;
        await this.persist();
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
    await this.waitForTabComplete(tabId);
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
      await sleep(1000);
      const tab = await this.tryGetTab(tabId);
      const url = tab?.url || '';
      if (/\/notebook\/[0-9a-f-]{8,}/i.test(url)) {
        // Give the add-source UI a moment to render.
        await sleep(1200);
        return url;
      }
    }
    return null;
  }

  private async persist(): Promise<void> {
    try {
      const lite = Array.from(this.jobs.values()).slice(-20);
      await chrome.storage.session.set({ [JOBS_KEY]: lite });
    } catch {
      // session storage unavailable
    }
  }

  private async hydrate(jobId: string): Promise<NblmJob | undefined> {
    try {
      const arr = (await chrome.storage.session.get(JOBS_KEY))[JOBS_KEY];
      if (Array.isArray(arr)) {
        const found = arr.find((j: any) => j && j.jobId === jobId);
        if (found) {
          this.jobs.set(jobId, found);
          return found;
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  private waitForTabComplete(tabId: number, timeoutMs = 25000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // already gone
        }
        clearTimeout(timer);
        setTimeout(resolve, 700);
      };
      const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && info.status === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.get(tabId).then(
          (t) => {
            if (t.status === 'complete') finish();
          },
          () => finish(),
        );
      }, 800);
    });
  }
}

export const notebookLmCreateTool = new NotebookLMCreateTool();
