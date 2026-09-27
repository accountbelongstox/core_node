import {
  createErrorResponse,
  createJsonContent,
  createJsonResponse,
  toErrorMessage,
  ToolResult,
} from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';
import { AsyncMutex, TimeoutController, delay } from '@/utils/async';
import { waitForTabComplete } from '@/utils/tab-readiness';
import { SessionJobStore } from '@/utils/session-job-store';

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
const TAB_READY_OPTIONS = {
  timeoutMs: 20000,
  settleDelayMs: 600,
  statusProbeDelayMs: 700,
};
const DEFAULT_JOB_TIMEOUT_MS = 120000;
const MIN_JOB_TIMEOUT_MS = 15000;
// Bounded wait for the tab so an interactive call answers inside the default
// 30s bridge timeout while another generation holds the tab.
const GENERATION_LOCK_WAIT_MS = 20000;
const JOB_LEASE_GRACE_MS = 5000;
const TAB_BUSY_ERROR = 'The Gemini tab is busy with another image generation; retry shortly';
const JOB_ABANDONED_ERROR = 'Image job abandoned before its image was collected';

export type GeminiJobStatus = 'generating' | 'done' | 'failed';

export interface GeminiJob {
  jobId: string;
  tabId: number;
  prompt: string;
  status: GeminiJobStatus;
  deadline: number; // epoch ms
  baselineImageKeys: string[];
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

export interface GeminiStartResult {
  ok: boolean;
  jobId?: string;
  tabId?: number;
  status?: GeminiJobStatus;
  error?: string;
  hint?: string;
}

export interface GeminiStatusResult {
  ok: boolean;
  status: GeminiJobStatus | 'unknown';
  generating?: boolean;
  dataUrl?: string | null;
  mime?: string | null;
  width?: number;
  height?: number;
  src?: string | null;
  error?: string;
}

interface GeminiJobLease {
  release: () => void;
  expiry: TimeoutController;
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

  private readonly jobStore = new SessionJobStore<GeminiJob>(JOBS_KEY, {
    serialize: ({ dataUrl: _dataUrl, ...job }) => job,
    deserialize: (stored) => ({ ...stored, dataUrl: null }) as unknown as GeminiJob,
  });
  // One Gemini tab serves every generation: this tool, the popup and the image
  // worker (generateViaGemini) each hold this mutex from submit to collect.
  private readonly generationMutex = new AsyncMutex();
  private readonly jobLeases = new Map<string, GeminiJobLease>();

  /** MCP entrypoint — routes to start/status by `action` (or presence of jobId). */
  async execute(args: GeminiImageParams): Promise<ToolResult> {
    const action = args?.action || (args?.jobId ? 'status' : 'start');

    try {
      if (action === 'status') {
        const jobId = String(args?.jobId || '');
        if (!jobId) return createErrorResponse("jobId is required for action='status'");
        const r = await this.statusExclusive(jobId);
        if (r.status === 'done' && r.dataUrl) {
          const base64 = r.dataUrl.replace(/^data:[^;]+;base64,/, '');
          return {
            content: [
              { type: 'image', data: base64, mimeType: r.mime || 'image/png' },
              createJsonContent(
                { jobId, status: 'done', mime: r.mime, width: r.width, height: r.height, src: r.src },
                2,
              ),
            ],
            isError: false,
          };
        }
        return createJsonResponse({ jobId, ...r }, {
          isError: r.status === 'failed' || r.status === 'unknown',
          space: 2,
        });
      }

      // start
      const prompt = (args?.prompt || '').trim();
      if (!prompt) return createErrorResponse('prompt is required to start image generation');
      const r = await this.startExclusive(
        prompt,
        !!args?.openInNewTab,
        args?.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS,
      );
      return createJsonResponse(r, { isError: !r.ok, space: 2 });
    } catch (error) {
      return createErrorResponse(
        `Gemini image error: ${toErrorMessage(error)}`,
      );
    }
  }

  /** Run fn while holding the Gemini tab (the image worker's whole generation). */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.generationMutex.acquire();

    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Interactive start (MCP tool, popup): the job keeps the tab from submit
   * until its image is collected, it fails, or its deadline passes; an
   * uncollected job goes through cancel() before the tab is released.
   */
  async startExclusive(
    prompt: string,
    openInNewTab = false,
    timeoutMs = DEFAULT_JOB_TIMEOUT_MS,
  ): Promise<GeminiStartResult> {
    const release = await this.acquireGenerationLock();
    let result: GeminiStartResult;

    if (!release) return { ok: false, error: TAB_BUSY_ERROR };
    try {
      result = await this.start(prompt, openInNewTab, timeoutMs);
    } catch (error) {
      release();
      throw error;
    }
    if (!result.ok || !result.jobId) {
      release();
      return result;
    }
    this.holdJobLease(result.jobId, release, Math.max(MIN_JOB_TIMEOUT_MS, timeoutMs));
    return result;
  }

  /** Interactive status poll: inside the job's own lease, or under the mutex. */
  async statusExclusive(jobId: string): Promise<GeminiStatusResult> {
    let release: (() => void) | null = null;
    let result: GeminiStatusResult;

    if (this.jobLeases.has(jobId)) {
      result = await this.status(jobId);
      if (result.status !== 'generating') {
        await this.settleJobLease(jobId, result.status === 'done');
      }
      return result;
    }

    release = await this.acquireGenerationLock();
    if (!release) return { ok: true, status: 'generating', generating: true };
    try {
      return await this.status(jobId);
    } finally {
      release();
    }
  }

  /** Phase 1: open/reuse a Gemini tab, submit the prompt, register a job. Fast. */
  async start(
    prompt: string,
    openInNewTab = false,
    timeoutMs = DEFAULT_JOB_TIMEOUT_MS,
  ): Promise<GeminiStartResult> {
    const tab = await this.resolveTab(openInNewTab);
    if (!tab?.id) return { ok: false, error: 'Failed to open or find a Gemini tab' };
    await this.ensureOnGeminiPage(tab.id);
    await this.injectContentScript(tab.id, [HELPER]);
    await delay(350);

    const snapshot = await this.sendMessageToTab(tab.id, {
      action: 'geminiSnapshotImages',
    }).catch(() => null);
    if (!snapshot?.ok || !Array.isArray(snapshot.imageKeys)) {
      return { ok: false, tabId: tab.id, error: 'Failed to snapshot existing Gemini images' };
    }

    const submit = await this.sendMessageToTab(tab.id, { action: 'geminiSubmitPrompt', prompt }).catch(
      (e: any) => ({ found: false, error: String(e?.message || e) }),
    );
    if (!submit || !submit.found) {
      return { ok: false, tabId: tab.id, error: (submit && submit.error) || 'Gemini prompt input not found' };
    }

    const jobId = this.genId();
    this.jobStore.set({
      jobId,
      tabId: tab.id,
      prompt,
      status: 'generating',
      deadline: Date.now() + Math.max(MIN_JOB_TIMEOUT_MS, timeoutMs),
      baselineImageKeys: snapshot.imageKeys,
      dataUrl: null,
    });
    await this.jobStore.persist();
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
  async status(jobId: string): Promise<GeminiStatusResult> {
    let job = this.jobStore.get(jobId);
    if (!job) job = await this.jobStore.hydrate(jobId);
    if (!job) return { ok: false, status: 'unknown', error: 'Unknown jobId (expired or never started)' };
    if (!Array.isArray(job.baselineImageKeys)) {
      return { ok: false, status: 'failed', error: 'Image job predates result isolation; start it again' };
    }

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
    // A failed (timed-out or cancelled) job is final: an image rendering late
    // belongs to no job.
    if (job.status === 'failed') {
      return { ok: false, status: 'failed', error: job.error ?? undefined };
    }

    try {
      // The image stays on the page, so this re-collects even after an SW restart.
      await this.injectContentScript(job.tabId, [HELPER]);
      const r = await this.sendMessageToTab(job.tabId, {
        action: 'geminiCollectImage',
        excludedImageKeys: job.baselineImageKeys,
      });
      if (r && r.ready && r.dataUrl) {
        job.status = 'done';
        job.dataUrl = r.dataUrl;
        job.mime = r.mime || 'image/png';
        job.width = r.width;
        job.height = r.height;
        job.src = r.src || null;
        await this.jobStore.persist();
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
        await this.jobStore.persist();
        return { ok: false, status: 'failed', error: job.error };
      }
      return { ok: true, status: 'generating', generating: !!(r && r.generating) };
    } catch (error: any) {
      // Tab message failed (tab closed / not ready). Fail only past the deadline.
      if (Date.now() > job.deadline) {
        const msg = error?.message || 'Gemini tab unreachable';
        job.status = 'failed';
        job.error = msg;
        await this.jobStore.persist();
        return { ok: false, status: 'failed', error: msg };
      }
      return { ok: true, status: 'generating', generating: true };
    }
  }

  /**
   * Abandon a job that will not be collected: mark it failed and move its tab
   * to a fresh chat, so an image that renders late can never sit beside the
   * next job's baseline snapshot and be taken as that job's result. Callers
   * hold the generation mutex (runExclusive or the job's own lease).
   */
  async cancel(jobId: string, reason: string): Promise<void> {
    let job = this.jobStore.get(jobId);
    if (!job) job = await this.jobStore.hydrate(jobId);
    if (!job) return;
    if (job.status === 'generating') {
      job.status = 'failed';
      job.error = reason;
      await this.jobStore.persist();
    }
    try {
      await chrome.tabs.update(job.tabId, { url: GEMINI_URL });
      await waitForTabComplete(job.tabId, TAB_READY_OPTIONS);
      logger.info(LOG, `Cancelled job ${jobId}; tab ${job.tabId} moved to a fresh chat`);
    } catch (error) {
      logger.warn(LOG, `Failed to reset tab ${job.tabId} for cancelled job ${jobId}`, error);
    }
  }

  // ------------------------------------------------------------------

  private genId(): string {
    return `gi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Wait a bounded time for the tab; a lock granted after the wait is freed at once. */
  private async acquireGenerationLock(): Promise<(() => void) | null> {
    const pending = this.generationMutex.acquire();
    const release = await Promise.race([
      pending,
      delay(GENERATION_LOCK_WAIT_MS).then(() => null),
    ]);

    if (!release) {
      void pending.then((lateRelease) => lateRelease());
    }
    return release;
  }

  private holdJobLease(jobId: string, release: () => void, timeoutMs: number): void {
    const expiry = new TimeoutController();

    this.jobLeases.set(jobId, { release, expiry });
    expiry.schedule(() => void this.settleJobLease(jobId, false), timeoutMs + JOB_LEASE_GRACE_MS);
  }

  private async settleJobLease(jobId: string, collected: boolean): Promise<void> {
    const lease = this.jobLeases.get(jobId);

    if (!lease) return;
    this.jobLeases.delete(jobId);
    lease.expiry.cancel();
    try {
      if (!collected) await this.cancel(jobId, JOB_ABANDONED_ERROR);
    } finally {
      lease.release();
    }
  }

  /** Ensure the tab is on the Gemini app; navigate there if not. */
  private async ensureOnGeminiPage(tabId: number): Promise<void> {
    const tab = await this.tryGetTab(tabId);
    if (!tab || !tab.url || !tab.url.includes('gemini.google.com')) {
      await chrome.tabs.update(tabId, { url: GEMINI_URL });
    }
    await waitForTabComplete(tabId, TAB_READY_OPTIONS);
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

}

export const geminiImageTool = new GeminiImageTool();
