/**
 * Shared async job/poll base for web-chat automation tools (Gemini, ChatGPT,
 * Grok, Copilot, …). The logic is identical across providers — resolve/open a
 * tab, submit a prompt, poll for a stable reply — only the per-site content
 * script (input/send selectors, response extraction) differs. Subclasses
 * supply that via `jobConfig` and their own inject-scripts/*-helper.js.
 *
 * Two-phase flow (mirrors gemini-image.ts): `start` submits and returns a
 * jobId in a few seconds; `status` re-collects from the still-open tab and
 * can be polled again anytime, including after the popup (or the MV3 service
 * worker) restarts — the job index is persisted to chrome.storage.session.
 *
 * Stability is tracked ACROSS polls, not within one poll: each `status` call
 * does one instant, non-blocking peek of the current reply text, and the job
 * stores lastSnapshot/stableRounds. A reply that is still streaming when a
 * poll starts is not missed, unlike a design that restarts a "3 consecutive
 * stable reads" search from scratch inside every single call.
 */
import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';
import { findOrCreateProviderTab, waitForTabComplete } from './ai-web-common';

// Poll cadence for the default synchronous execute() wrapper below.
const EXECUTE_POLL_INTERVAL_MS = 2000;

const STABLE_ROUNDS_REQUIRED = 2;

export type WebChatJobStatus = 'generating' | 'done' | 'failed';

export interface WebChatJob {
  jobId: string;
  tabId: number;
  prompt: string;
  before: number;
  status: WebChatJobStatus;
  deadline: number; // epoch ms
  answer: string | null;
  error?: string | null;
  lastSnapshot?: string; // last observed reply text, for cross-poll stability
  stableRounds?: number; // consecutive polls where the text did not change
}

export interface WebChatJobConfig {
  providerLabel: string; // log label, e.g. 'Gemini Web'
  providerHost: string; // e.g. 'gemini.google.com'
  providerUrl: string; // e.g. 'https://gemini.google.com/app'
  helperFiles: string[]; // content-script files to inject, in order
  submitAction: string; // e.g. 'geminiSubmitPrompt'
  peekAction: string; // e.g. 'geminiPeekReply'
  jobsStorageKey: string; // chrome.storage.session key for this provider's jobs
  // Optional one-shot content-script action fired (fire-and-forget) once a job
  // reaches 'done' — e.g. Copilot closing the canvas page it opened to extract
  // the reply. Providers without a post-extraction cleanup step omit this.
  cleanupAction?: string;
}

export abstract class WebChatJobToolBase extends BaseBrowserToolExecutor {
  protected abstract jobConfig: WebChatJobConfig;

  private jobs = new Map<string, WebChatJob>();

  /** Phase 1: open/reuse the provider tab, submit the prompt, register a job. */
  async start(
    prompt: string,
    timeoutMs = 180000,
  ): Promise<{ ok: boolean; jobId?: string; tabId?: number; status?: WebChatJobStatus; error?: string; hint?: string }> {
    const cfg = this.jobConfig;
    const p = (prompt || '').trim();
    if (!p) return { ok: false, error: 'Prompt is required' };

    try {
      logger.info(cfg.providerLabel, `start: resolving tab (${p.length} char prompt)`);
      const { tabId } = await findOrCreateProviderTab(cfg.providerHost, cfg.providerUrl, undefined);
      logger.info(cfg.providerLabel, `start: tab ${tabId} resolved, waiting for load`);
      await waitForTabComplete(tabId);
      logger.info(cfg.providerLabel, `start: tab ${tabId} loaded, injecting content script`);
      await this.injectContentScript(tabId, cfg.helperFiles);
      logger.info(cfg.providerLabel, `start: content script ready on tab ${tabId}, submitting prompt`);

      const submitted = await this.sendMessageToTab(tabId, { action: cfg.submitAction, prompt: p });
      if (!submitted || !submitted.found) {
        const err = submitted?.error || 'Prompt input not found';
        logger.warn(cfg.providerLabel, `start: submit failed on tab ${tabId}: ${err}`);
        return { ok: false, tabId, error: err };
      }

      const jobId = this.genJobId();
      this.jobs.set(jobId, {
        jobId,
        tabId,
        prompt: p,
        before: submitted.before || 0,
        status: 'generating',
        deadline: Date.now() + Math.max(15000, timeoutMs),
        answer: null,
      });
      await this.persistJobs();
      logger.info(cfg.providerLabel, `Started job ${jobId} on tab ${tabId}: "${p.slice(0, 60)}"`);
      return {
        ok: true,
        jobId,
        tabId,
        status: 'generating',
        hint: "Poll with action='status' and this jobId until status is 'done' or 'failed'.",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(cfg.providerLabel, `start: threw before a job could be created: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  /**
   * Default synchronous entrypoint (satisfies BaseBrowserToolExecutor.execute)
   * built from start()+status(): providers without a richer need (e.g. audio
   * capture) can rely on this as-is. Gemini/ChatGPT override it directly.
   */
  async execute(args: { prompt: string; timeoutMs?: number }): Promise<ToolResult> {
    const { prompt, timeoutMs = 120000 } = args || ({} as any);
    const started = await this.start(prompt, timeoutMs);
    if (!started.ok || !started.jobId) {
      return createErrorResponse(started.error || `${this.jobConfig.providerLabel} failed to start`);
    }
    const jobId = started.jobId;
    const deadline = Date.now() + Math.max(15000, timeoutMs);
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, EXECUTE_POLL_INTERVAL_MS));
      const s = await this.status(jobId);
      if (s.status === 'done') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                provider: this.jobConfig.providerLabel,
                success: true,
                answer: s.answer,
                tabId: started.tabId,
              }),
            },
          ],
          isError: false,
        };
      }
      if (s.status === 'failed' || s.status === 'unknown') {
        return createErrorResponse(s.error || `${this.jobConfig.providerLabel} reply failed`);
      }
    }
    return createErrorResponse(`Timed out waiting for the ${this.jobConfig.providerLabel} reply`);
  }

  /** Phase 2: re-collect the reply from the tab; resolves done/generating/failed. */
  async status(
    jobId: string,
  ): Promise<{ ok: boolean; status: WebChatJobStatus | 'unknown'; answer?: string | null; error?: string }> {
    const cfg = this.jobConfig;
    let job = this.jobs.get(jobId);
    if (!job) job = await this.hydrateJob(jobId);
    if (!job) return { ok: false, status: 'unknown', error: 'Unknown jobId (expired or never started)' };

    if (job.status === 'done') {
      return { ok: true, status: 'done', answer: job.answer };
    }
    if (job.status === 'failed') {
      return { ok: false, status: 'failed', error: job.error || 'Reply failed' };
    }

    try {
      // Re-inject defensively: a re-injected tab (SW restart, page reload) has
      // no listener otherwise; injectContentScript pings first and no-ops if
      // the content script is already active, so this is cheap on the happy path.
      await this.injectContentScript(job.tabId, cfg.helperFiles);
      const peek = await this.sendMessageToTab(job.tabId, { action: cfg.peekAction, before: job.before });
      const text = typeof peek?.text === 'string' ? peek.text.trim() : '';

      const gotFreshContent = !!(peek?.hasBlock && text);
      if (gotFreshContent) {
        if (text === job.lastSnapshot) {
          job.stableRounds = (job.stableRounds || 0) + 1;
        } else {
          job.lastSnapshot = text;
          job.stableRounds = 0;
        }
        if (job.stableRounds >= STABLE_ROUNDS_REQUIRED) {
          job.status = 'done';
          job.answer = text;
          await this.persistJobs();
          logger.info(cfg.providerLabel, `Job ${jobId} done (${text.length} chars)`);
          if (cfg.cleanupAction) {
            // Fire-and-forget: e.g. Copilot closing the canvas page it opened
            // to extract the reply. A cleanup failure must never affect the
            // answer already collected above.
            this.sendMessageToTab(job.tabId, { action: cfg.cleanupAction }).catch(() => {});
          }
          return { ok: true, status: 'done', answer: job.answer };
        }
      }

      // Only time out a poll that found NOTHING at all. The popup (and thus
      // polling) can be closed by Chrome for a long stretch — a client
      // reconnecting late must still be able to pick up a reply that finished
      // generating while it was gone, even though `deadline` (fixed at job
      // start) has since elapsed; failing here would discard a fresh,
      // perfectly retrievable read purely because the client reconnected
      // late, and only 1 of the 2 confirming polls has happened so far.
      if (!gotFreshContent && Date.now() > job.deadline) {
        const timeoutMsg = 'Timed out waiting for the reply to stabilize';
        job.status = 'failed';
        job.error = timeoutMsg;
        await this.persistJobs();
        return { ok: false, status: 'failed', error: timeoutMsg };
      }
      await this.persistJobs();
      return { ok: true, status: 'generating' };
    } catch (error: any) {
      // Tab message failed (tab closed / not ready). Fail only past the deadline.
      if (Date.now() > job.deadline) {
        const msg = error?.message || 'Tab unreachable';
        job.status = 'failed';
        job.error = msg;
        await this.persistJobs();
        return { ok: false, status: 'failed', error: msg };
      }
      return { ok: true, status: 'generating' };
    }
  }

  private genJobId(): string {
    return `wc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Persist a lightweight job index for SW-restart recovery. */
  private async persistJobs(): Promise<void> {
    try {
      const lite = Array.from(this.jobs.values()).slice(-20);
      await chrome.storage.session.set({ [this.jobConfig.jobsStorageKey]: lite });
    } catch {
      // session storage unavailable — in-memory only.
    }
  }

  private async hydrateJob(jobId: string): Promise<WebChatJob | undefined> {
    try {
      const arr = (await chrome.storage.session.get(this.jobConfig.jobsStorageKey))[this.jobConfig.jobsStorageKey];
      if (Array.isArray(arr)) {
        const found = arr.find((j: any) => j && j.jobId === jobId);
        if (found) {
          this.jobs.set(jobId, found);
          return found as WebChatJob;
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }
}
