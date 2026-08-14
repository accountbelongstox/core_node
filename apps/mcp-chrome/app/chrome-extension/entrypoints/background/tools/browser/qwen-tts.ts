import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { logger } from '@/utils/logger';
import { gradioFrameForTabUrl, waitForGradioFrame } from '@/utils/qwen-tts-frame';
import { waitForTabComplete } from '@/utils/tab-readiness';
import { delay as waitForDelay, withTimeout } from '@/utils/async';
import {
  QWEN_TTS_LAST_VERIFIED,
  QWEN_TTS_SPACE_URL,
  isQwenTtsTabUrl,
  type QwenTtsAudioPayload,
  type QwenTtsMode,
  type QwenTtsRequest,
  type QwenTtsResult,
  type QwenTtsStatus,
} from '@/utils/qwen-tts-core';

const LOG = 'Qwen TTS Tool';
const TOOL_NAME = TOOL_NAMES.BROWSER.QWEN_TTS;
const HELPER_SCRIPTS = ['inject-scripts/web-ops.js', 'inject-scripts/qwen-tts-helper.js'];
const PING_TIMEOUT_MS = 300;

interface QwenTtsGenerateResponse {
  ok: boolean;
  mime?: string;
  bytes?: number[];
  src?: string;
  statusText?: string;
  error?: string;
  mode?: QwenTtsMode;
  text?: string;
}

class QwenTtsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAME;

  async execute(args: QwenTtsRequest): Promise<ToolResult> {
    try {
      const result = await this.run(args);
      return createJsonResponse(result, { isError: !result.ok, space: 2 });
    } catch (error) {
      logger.error(LOG, 'execute failed', error);
      return createErrorResponse(
        `Qwen TTS failed: ${toErrorMessage(error)}`,
      );
    }
  }

  async run(request: QwenTtsRequest, onPhase?: (phase: string, detail: string) => Promise<void>): Promise<QwenTtsResult> {
    const started = Date.now();
    const text = String(request.text || '').trim();
    const mode: QwenTtsMode =
      request.mode === 'voice_clone' || request.mode === 'custom_voice' ? request.mode : 'voice_design';
    const waitTimeoutMs = Math.max(15_000, Number(request.waitTimeoutMs) || 180_000);
    const shouldDownload = request.download !== false;

    const phase = async (p: string, d: string) => {
      if (onPhase) await onPhase(p, d);
    };

    if (!text) {
      return this.failResult(text, mode, started, 'Text is required');
    }

    await phase('Opening', QWEN_TTS_SPACE_URL);
    const { tabId, tabUrl } = await this.resolveTab(request.tabId, !!request.openInNewTab);
    await waitForTabComplete(tabId, {
      timeoutMs: 60_000,
      settleDelayMs: 1200,
      statusProbeDelayMs: 800,
    });

    await phase('Waiting', 'Gradio iframe load');
    let frameId = gradioFrameForTabUrl(tabUrl);
    if (frameId === null) {
      frameId = await waitForGradioFrame(tabId, waitTimeoutMs);
    }

    await phase('Injecting', `frame ${frameId}`);
    await this.injectInFrame(tabId, frameId, HELPER_SCRIPTS);
    await waitForDelay(500);

    await phase('Submitting', `${mode} · ${text.slice(0, 48)}`);
    await phase('Waiting', `GPU queue · up to ${Math.round(waitTimeoutMs / 1000)}s`);

    const resp = (await this.sendMessageToTab(tabId, {
      action: 'qwenTtsGenerate',
      mode,
      text,
      language: request.language,
      voiceDescription: request.voiceDescription,
      styleInstruction: request.styleInstruction,
      speaker: request.speaker,
      waitTimeoutMs,
    }, frameId)) as QwenTtsGenerateResponse | undefined;

    if (!resp) {
      return this.failResult(text, mode, started, 'No response from Qwen TTS helper (iframe)', tabId);
    }
    if (!resp.ok || !resp.bytes?.length) {
      return this.failResult(
        text,
        mode,
        started,
        resp.error || resp.statusText || 'Qwen TTS generation failed',
        tabId,
        'error',
      );
    }

    const audio: QwenTtsAudioPayload = {
      ok: true,
      mime: resp.mime || 'audio/wav',
      bytes: resp.bytes,
      src: resp.src,
    };

    let downloadId: number | undefined;
    let downloadFilename: string | undefined;
    if (shouldDownload) {
      await phase('Downloading', resp.mime || 'audio');
      const saved = await this.saveAudioDownload(
        resp.bytes,
        resp.mime || 'audio/wav',
        request.filename || this.defaultFilename(mode, text),
      );
      downloadId = saved.downloadId;
      downloadFilename = saved.filename;
    }

    await phase('Done', downloadFilename || 'audio ready');
    return {
      ok: true,
      status: 'ok',
      message: resp.statusText || 'Audio generated',
      text,
      mode,
      url: QWEN_TTS_SPACE_URL,
      tabId,
      frameId,
      audio,
      downloadId,
      downloadFilename,
      elapsedMs: Date.now() - started,
      lastVerified: QWEN_TTS_LAST_VERIFIED,
    };
  }

  private failResult(
    text: string,
    mode: QwenTtsMode,
    started: number,
    message: string,
    tabId?: number,
    status: QwenTtsStatus = 'error',
  ): QwenTtsResult {
    return {
      ok: false,
      status,
      message,
      text,
      mode,
      url: QWEN_TTS_SPACE_URL,
      tabId,
      elapsedMs: Date.now() - started,
      lastVerified: QWEN_TTS_LAST_VERIFIED,
      error: message,
    };
  }

  private defaultFilename(mode: QwenTtsMode, text: string): string {
    const slug = text
      .slice(0, 32)
      .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'qwen-tts';
    return `qwen3-tts-${mode}-${slug}.wav`;
  }

  private async saveAudioDownload(
    bytes: number[],
    mime: string,
    filename: string,
  ): Promise<{ downloadId?: number; filename: string }> {
    const byteArray = new Uint8Array(bytes);
    const chunks: string[] = [];
    const chunkSize = 0x8000;
    for (let offset = 0; offset < byteArray.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...byteArray.subarray(offset, offset + chunkSize)));
    }
    const url = `data:${mime};base64,${btoa(chunks.join(''))}`;
    const downloadId = await chrome.downloads.download({ url, filename, saveAs: false });
    return { downloadId, filename };
  }

  private async resolveTab(
    explicitTabId?: number,
    openInNewTab = false,
  ): Promise<{ tabId: number; tabUrl: string }> {
    if (explicitTabId) {
      const tab = await this.tryGetTab(explicitTabId);
      if (tab?.id) {
        const url = isQwenTtsTabUrl(tab.url) ? tab.url! : QWEN_TTS_SPACE_URL;
        await chrome.tabs.update(tab.id, { url, active: true });
        return { tabId: tab.id, tabUrl: url };
      }
    }

    if (!openInNewTab) {
      const tabs = await chrome.tabs.query({});
      const existing = tabs.find((t) => isQwenTtsTabUrl(t.url));
      if (existing?.id) {
        await chrome.tabs.update(existing.id, { active: true });
        return { tabId: existing.id, tabUrl: existing.url || QWEN_TTS_SPACE_URL };
      }
    }

    const tab = await chrome.tabs.create({ url: QWEN_TTS_SPACE_URL, active: true });
    if (!tab.id) throw new Error('Failed to open Qwen TTS Space tab');
    return { tabId: tab.id, tabUrl: tab.url || QWEN_TTS_SPACE_URL };
  }

  private async injectInFrame(tabId: number, frameId: number, files: string[]): Promise<void> {
    try {
      const response = await withTimeout(
        chrome.tabs.sendMessage(
          tabId,
          { action: `${this.name}_ping`, files },
          { frameId },
        ),
        PING_TIMEOUT_MS,
        'ping timeout',
      );
      if (response && (response as { status?: string }).status === 'pong') {
        return;
      }
    } catch {
      // inject below
    }

    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files,
    });
  }

}

export const qwenTtsTool = new QwenTtsTool();
