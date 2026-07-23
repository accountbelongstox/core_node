import type { ProcessorType, Task, WorkerCapability } from '../api/WorkerApiClient';
import { runQwenTts } from './qwen-tts-service';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { bytesToBase64 } from '@/utils/binary';
import { logger } from '@/utils/logger';
import {
  DEFAULT_QWEN_TTS_SETTINGS,
  QWEN_TTS_SETTING_KEYS,
  type QwenTtsMode,
  type QwenTtsSettings,
} from '@/utils/qwen-tts-core';
import { UI_STORAGE_PREFIX } from '@/utils/storage-keys';
import { LANES } from '@/utils/task-center-lanes';

const LOG = 'Qwen TTS Worker';

interface AudioWord {
  word: string;
  md5?: string;
}

class QwenTtsWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return LANES.QWEN_TTS;
  }

  protected get workerIdStorageKey(): string {
    return 'qwen_tts_worker_id_base';
  }

  protected get capabilities(): WorkerCapability[] {
    return ['audio'];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_AUDIO];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'word_audio' || taskType === 'article_audio';
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = task.payload || {};
    const settings = await this.loadSettings();

    if (task.task_type === 'article_audio') {
      await this.executeArticleAudio(task, settings);
      return;
    }

    const words = this.normalizeWords(payload);
    if (words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'word_audio payload carried no words or content',
      });
      return;
    }

    const translations: Array<Record<string, unknown>> = [];
    const failures: string[] = [];

    for (let index = 0; index < words.length; index++) {
      const item = words[index];
      const result = await runQwenTts({
        text: item.word,
        mode: this.resolveMode(payload.mode, settings.mode),
        voiceDescription: String(payload.voice_description || settings.voiceDescription),
        styleInstruction: String(payload.style_instruction || settings.styleInstruction),
        language: String(payload.language || ''),
        waitTimeoutMs: this.resolveTimeout(payload.wait_timeout_ms, settings.waitTimeoutSec),
        openInNewTab: false,
        download: false,
      });
      const bytes = result.audio?.bytes || [];

      if (!result.ok || bytes.length === 0) {
        failures.push(`${item.word}: ${result.error || result.message || 'no audio bytes'}`);
      } else {
        translations.push({
          word: item.word,
          ...(item.md5 ? { md5: item.md5 } : {}),
          audio_base64: bytesToBase64(bytes),
          audio_mime: result.audio?.mime || 'audio/wav',
        });
      }

      if (index + 1 < words.length) {
        await this.submitResult(task.task_id, 'processing', undefined, {
          progress: Math.round(((index + 1) / words.length) * 100),
        });
      }
    }

    if (translations.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: failures.join('; ') || 'Qwen TTS produced no audio',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      translations,
      target_language: String(payload.target_language || 'zh'),
      provider: 'qwen3-tts',
      failed_words: failures,
    });
    logger.info(
      LOG,
      `Task ${task.task_id} completed (${translations.length}/${words.length} audio items)`,
    );
  }

  private async executeArticleAudio(task: Task, settings: QwenTtsSettings): Promise<void> {
    const payload = task.payload || {};
    const text = String(payload.content || payload.text || '').trim();
    if (!text) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'article_audio payload carried no content',
      });
      return;
    }

    const result = await runQwenTts({
      text,
      mode: this.resolveMode(payload.mode, settings.mode),
      voiceDescription: String(payload.voice_description || settings.voiceDescription),
      styleInstruction: String(payload.style_instruction || settings.styleInstruction),
      language: String(payload.language || ''),
      waitTimeoutMs: this.resolveTimeout(payload.wait_timeout_ms, settings.waitTimeoutSec),
      openInNewTab: false,
      download: false,
    });
    const bytes = result.audio?.bytes || [];

    if (!result.ok || bytes.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: result.error || result.message || 'Qwen TTS produced no audio',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      audio_base64: bytesToBase64(bytes),
      mime: result.audio?.mime || 'audio/wav',
      provider: 'qwen3-tts',
    });
  }

  private normalizeWords(payload: Task['payload']): AudioWord[] {
    const words: AudioWord[] = [];
    const rawWords = Array.isArray(payload.words) ? payload.words : [];

    for (const item of rawWords) {
      const word = typeof item === 'string' ? item.trim() : String(item?.word || '').trim();
      if (!word) continue;
      words.push({
        word,
        ...(typeof item === 'object' && item?.md5 ? { md5: String(item.md5) } : {}),
      });
    }

    if (words.length === 0) {
      const word = String(payload.word || payload.content || '').trim();
      if (word) {
        words.push({
          word,
          ...(payload.md5 ? { md5: String(payload.md5) } : {}),
        });
      }
    }

    return words;
  }

  private async loadSettings(): Promise<QwenTtsSettings> {
    const storageKeys = Object.values(QWEN_TTS_SETTING_KEYS)
      .filter((key) => key !== QWEN_TTS_SETTING_KEYS.TEXT)
      .map((key) => UI_STORAGE_PREFIX + key);
    const stored = await chrome.storage.local.get(storageKeys);
    const read = (key: string): unknown => stored[UI_STORAGE_PREFIX + key];
    const mode = read(QWEN_TTS_SETTING_KEYS.MODE);

    return {
      mode: this.resolveMode(mode, DEFAULT_QWEN_TTS_SETTINGS.mode),
      voiceDescription: String(
        read(QWEN_TTS_SETTING_KEYS.VOICE_DESCRIPTION)
          || DEFAULT_QWEN_TTS_SETTINGS.voiceDescription,
      ),
      styleInstruction: String(
        read(QWEN_TTS_SETTING_KEYS.STYLE_INSTRUCTION)
          || DEFAULT_QWEN_TTS_SETTINGS.styleInstruction,
      ),
      waitTimeoutSec: Number(
        read(QWEN_TTS_SETTING_KEYS.WAIT_TIMEOUT_SEC)
          || DEFAULT_QWEN_TTS_SETTINGS.waitTimeoutSec,
      ),
      openInNewTab: false,
      autoDownload: false,
    };
  }

  private resolveMode(value: unknown, fallback: QwenTtsMode): QwenTtsMode {
    if (value === 'voice_clone' || value === 'custom_voice' || value === 'voice_design') {
      return value;
    }
    return fallback;
  }

  private resolveTimeout(value: unknown, fallbackSeconds: number): number {
    const milliseconds = Number(value);
    if (Number.isFinite(milliseconds) && milliseconds >= 30000) return milliseconds;
    return Math.max(30, Number(fallbackSeconds) || 180) * 1000;
  }
}

export const qwenTtsWorkerService = new QwenTtsWorkerService();
