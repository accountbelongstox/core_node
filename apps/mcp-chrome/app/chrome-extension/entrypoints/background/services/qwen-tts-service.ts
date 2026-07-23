/**
 * Qwen3-TTS service — popup + MCP orchestration with progress + download.
 * Last verified: 2026-07-13
 */

import { logger } from '@/utils/logger';
import { qwenTtsTool } from '../tools/browser/qwen-tts';
import {
  QWEN_TTS_LAST_VERIFIED,
  QWEN_TTS_PROGRESS_KEY,
  emptyQwenTtsProgress,
  type QwenTtsProgress,
  type QwenTtsRequest,
  type QwenTtsResult,
} from '@/utils/qwen-tts-core';

const LOG = 'Qwen TTS';
let runQueue: Promise<void> = Promise.resolve();

export async function saveQwenTtsProgress(patch: Partial<QwenTtsProgress>): Promise<void> {
  const prev = (await chrome.storage.local.get([QWEN_TTS_PROGRESS_KEY]))[QWEN_TTS_PROGRESS_KEY]
    || emptyQwenTtsProgress();
  const next: QwenTtsProgress = {
    ...emptyQwenTtsProgress(),
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [QWEN_TTS_PROGRESS_KEY]: next });
}

export async function getQwenTtsProgress(): Promise<QwenTtsProgress> {
  const stored = (await chrome.storage.local.get([QWEN_TTS_PROGRESS_KEY]))[QWEN_TTS_PROGRESS_KEY];
  return stored ? { ...emptyQwenTtsProgress(), ...stored } : emptyQwenTtsProgress();
}

export function runQwenTts(request: QwenTtsRequest): Promise<QwenTtsResult> {
  const run = runQueue.then(() => executeQwenTts(request));
  runQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function executeQwenTts(request: QwenTtsRequest): Promise<QwenTtsResult> {
  const text = String(request.text || '').trim();
  const mode = request.mode || 'voice_design';

  await saveQwenTtsProgress({
    running: true,
    phase: 'Starting',
    detail: mode,
    status: 'running',
    mode,
    text,
    tabId: request.tabId ?? null,
  });

  try {
    const result = await qwenTtsTool.run(request, async (phase, detail) => {
      await saveQwenTtsProgress({
        running: true,
        phase,
        detail,
        status: phase === 'Submitting' || phase === 'Waiting' ? 'waiting' : 'running',
        mode,
        text,
      });
    });

    await saveQwenTtsProgress({
      running: false,
      phase: result.ok ? 'Done' : 'Error',
      detail: result.message,
      status: result.ok ? 'ok' : result.status,
      mode,
      text,
      tabId: result.tabId ?? null,
    });

    logger.info(LOG, `${result.ok ? 'OK' : 'FAIL'} · ${result.elapsedMs}ms · ${result.downloadFilename || 'no-download'}`);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await saveQwenTtsProgress({
      running: false,
      phase: 'Error',
      detail: error,
      status: 'error',
      mode,
      text,
    });
    logger.error(LOG, error, err);
    return {
      ok: false,
      status: 'error',
      message: error,
      text,
      mode,
      url: '',
      elapsedMs: 0,
      lastVerified: QWEN_TTS_LAST_VERIFIED,
      error,
    };
  }
}
