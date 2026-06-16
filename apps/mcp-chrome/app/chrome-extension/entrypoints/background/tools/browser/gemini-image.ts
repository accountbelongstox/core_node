import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';

// MCP tool name. Kept as a literal (mirrored in chrome-mcp-shared TOOL_NAMES as
// BROWSER.GEMINI_IMAGE = 'chrome_gemini_image') so the extension build does not
// depend on the shared package being rebuilt to typecheck.
const GEMINI_IMAGE_TOOL_NAME = 'chrome_gemini_image';
const GEMINI_URL = 'https://gemini.google.com/app';
const HELPER = 'inject-scripts/gemini-image-helper.js';
const LOG = 'Gemini Image';
// Session storage key for the lightweight job index (no dataUrl) so a status
// poll can recover after the MV3 service worker restarts.
const JOBS_KEY = 'gemini_image_jobs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiJobStatus = 'generating' | 'done' | 'failed';

export interface GeminiJob {
  jobId: string;
  tabId: number;
  prompt: string;
  status: GeminiJobStatus;
  deadline: number; // epoch ms
  dataUrl: string | null;
  mime?: string | null;
  width?: number;
  height?: number;
  src?: string | null;
  error?: string | null;
}

interface GeminiImageParams {
  action?: 'start' | 'status';
  prompt?: string;
  jobId?: string;
  openInNewTab?: boolean;
  timeoutMs?: number;
}

/**
 * Drive Google Gemini to generate an image — ASYNC two-phase so neither the MCP
 * client nor the native-server bridge times out on a multi-minute generation:
 *
 *   action:"start"  {prompt}            -> submits the prompt, returns {jobId}
 *                                          immediately (a few seconds).
 *   action:"status" {jobId}             -> re-collects from the Gemini tab; when
 *                                          ready returns the image (MCP image
 *                                          content block / data URL).
 *
 * The generated image stays on the Gemini page, so a status poll can always
 * re-capture it from the tab — even after an MV3 service-worker restart (the
 * job index is persisted to session storage). Requires an authenticated Gemini
 * session in the browser.
 */
class GeminiImageTool extends BaseBrowserToolExecutor {
  name = GEMINI_IMAGE_TOOL_NAME;

  private jobs = new Map<string, GeminiJob>();

  /** MCP entrypoint — routes to start/status by `action` (or presence of jobId). */
  async execute(args: GeminiImageParams): Promise<ToolResult> {
    const action = args?.action || (args?.jobId ? 'status' : 'start');

    try {
      if (action === 'status') {
        const jobId = String(args?.jobId || '');
        if (!jobId) return createErrorResponse("jobId is required for action='status'");
        const r = await this.status(jobId);
        if (r.status === 'done' && r.dataUrl) {
          const base64 = r.dataUrl.replace(/^data:[^;]+;base64,/, '');
          return {
            content: [
              { type: 'image', data: base64, mimeType: r.mime || 'image/png' },
              {
                type: 'text',
                text: JSON.stringify(
                  { jobId, status: 'done', mime: r.mime, width: r.width, height: r.height, src: r.src },
                  null,
                  2,
                ),
              },
            ],
            isError: false,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ jobId, ...r }, null, 2) }],
          isError: r.status === 'failed' || r.status === 'unknown',
        };
      }

      // start
      const prompt = (args?.prompt || '').trim();
      if (!prompt) return createErrorResponse('prompt is required to start image generation');
      const r = await this.start(prompt, !!args?.openInNewTab, args?.timeoutMs ?? 120000);
      return {
        content: [{ type: 'text', text: JSON.stringify(r, null, 2) }],
        isError: !r.ok,
      };
    } catch (error) {
      return createErrorResponse(
        `Gemini image error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Phase 1: open/reuse a Gemini tab, submit the prompt, register a job. Fast. */
  async start(
    prompt: string,
    openInNewTab = false,
    timeoutMs = 120000,
  ): Promise<{ ok: boolean; jobId?: string; tabId?: number; status?: GeminiJobStatus; error?: string; hint?: string }> {
    const tab = await this.resolveTab(openInNewTab);
    if (!tab?.id) return { ok: false, error: 'Failed to open or find a Gemini tab' };
    await this.ensureOnGeminiPage(tab.id);
    await this.injectContentScript(tab.id, [HELPER]);
    await sleep(350);

    const submit = await this.sendMessageToTab(tab.id, { action: 'geminiSubmitPrompt', prompt }).catch(
      (e: any) => ({ found: false, error: String(e?.message || e) }),
    );
    if (!submit || !submit.found) {
      return { ok: false, tabId: tab.id, error: (submit && submit.error) || 'Gemini prompt input not found' };
    }

    const jobId = this.genId();
    this.jobs.set(jobId, {
      jobId,
      tabId: tab.id,
      prompt,
      status: 'generating',
      deadline: Date.now() + Math.max(15000, timeoutMs),
      dataUrl: null,
    });
    await this.persist();
    logger.info(LOG, `Started job ${jobId} on tab ${tab.id}: "${prompt.slice(0, 60)}"`);
    return {
      ok: true,
      jobId,
      tabId: tab.id,
      status: 'generating',
      hint: "Poll with action='status' and this jobId until status is 'done' or 'failed'.",
    };
  }

  /** Phase 2: re-collect the image from the tab; resolves done/generating/failed. */
  async status(
    jobId: string,
  ): Promise<{
    ok: boolean;
    status: GeminiJobStatus | 'unknown';
    generating?: boolean;
    dataUrl?: string | null;
    mime?: string | null;
    width?: number;
    height?: number;
    src?: string | null;
    error?: string;
  }> {
    let job = this.jobs.get(jobId);
    if (!job) job = await this.hydrate(jobId);
    if (!job) return { ok: false, status: 'unknown', error: 'Unknown jobId (expired or never started)' };

    if (job.status === 'done' && job.dataUrl) {
      return {
        ok: true,
        status: 'done',
        dataUrl: job.dataUrl,
        mime: job.mime,
        width: job.width,
        height: job.height,
        src: job.src,
      };
    }

    try {
      // The image stays on the page, so this re-collects even after an SW restart.
      await this.injectContentScript(job.tabId, [HELPER]);
      const r = await this.sendMessageToTab(job.tabId, { action: 'geminiCollectImage' });
      if (r && r.ready && r.dataUrl) {
        job.status = 'done';
        job.dataUrl = r.dataUrl;
        job.mime = r.mime || 'image/png';
        job.width = r.width;
        job.height = r.height;
        job.src = r.src || null;
        await this.persist();
        logger.info(LOG, `Job ${jobId} done (${job.width}x${job.height}, ${job.mime})`);
        return {
          ok: true,
          status: 'done',
          dataUrl: job.dataUrl,
          mime: job.mime,
          width: job.width,
          height: job.height,
          src: job.src,
        };
      }
      if (Date.now() > job.deadline) {
        job.status = 'failed';
        job.error = 'Timed out waiting for the generated image';
        await this.persist();
        return { ok: false, status: 'failed', error: job.error };
      }
      return { ok: true, status: 'generating', generating: !!(r && r.generating) };
    } catch (error: any) {
      // Tab message failed (tab closed / not ready). Fail only past the deadline.
      if (Date.now() > job.deadline) {
        const msg = error?.message || 'Gemini tab unreachable';
        job.status = 'failed';
        job.error = msg;
        await this.persist();
        return { ok: false, status: 'failed', error: msg };
      }
      return { ok: true, status: 'generating', generating: true };
    }
  }

  // ------------------------------------------------------------------

  private genId(): string {
    return `gi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Persist a lightweight job index (NO dataUrl — too big) for SW-restart recovery. */
  private async persist(): Promise<void> {
    try {
      const lite = Array.from(this.jobs.values())
        .slice(-20)
        .map(({ dataUrl: _omit, ...rest }) => rest);
      await chrome.storage.session.set({ [JOBS_KEY]: lite });
    } catch {
      // session storage unavailable — in-memory only.
    }
  }

  private async hydrate(jobId: string): Promise<GeminiJob | undefined> {
    try {
      const arr = (await chrome.storage.session.get(JOBS_KEY))[JOBS_KEY];
      if (Array.isArray(arr)) {
        const found = arr.find((j: any) => j && j.jobId === jobId);
        if (found) {
          const job: GeminiJob = { ...found, dataUrl: null };
          this.jobs.set(jobId, job);
          return job;
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /** Ensure the tab is on the Gemini app; navigate there if not. */
  private async ensureOnGeminiPage(tabId: number): Promise<void> {
    const tab = await this.tryGetTab(tabId);
    if (!tab || !tab.url || !tab.url.includes('gemini.google.com')) {
      await chrome.tabs.update(tabId, { url: GEMINI_URL });
    }
    await this.waitForTabComplete(tabId);
  }

  /** Reuse an open Gemini tab, or create one. */
  private async resolveTab(openInNewTab: boolean): Promise<chrome.tabs.Tab | undefined> {
    if (!openInNewTab) {
      const all = await chrome.tabs.query({});
      const tab = all.find((t) => t.url && t.url.includes('gemini.google.com'));
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true });
        return tab;
      }
    }
    return chrome.tabs.create({ url: GEMINI_URL, active: true });
  }

  private waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // listener already gone
        }
        clearTimeout(timer);
        setTimeout(resolve, 600);
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
      }, 700);
    });
  }
}

export const geminiImageTool = new GeminiImageTool();
