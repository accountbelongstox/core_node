/**
 * Initialize Task Processors
 * Registers all available processors to Task Center
 * Under 50 lines
 */

import { taskCenter } from './TaskCenter';
import { bingDictionaryProcessor } from './processors/BingDictionaryProcessor';
import { deepSeekProcessor } from './processors/DeepSeekProcessor';
import { googleNewsProcessor } from './processors/GoogleNewsProcessor';
import { webAiTranslateProcessor } from './processors/WebAiTranslateProcessor';
import { chatGptProcessor } from './processors/ChatGPTProcessor';
import { geminiProcessor } from './processors/GeminiProcessor';

/**
 * Initialize and register all task processors
 */
export function initializeProcessors(): void {
  console.log('[TaskCenter] Initializing processors...');

  // Register Bing Dictionary Processor (enabled by default)
  taskCenter.registerProcessor(bingDictionaryProcessor, true);

  // Register DeepSeek Processor (disabled by default, placeholder)
  taskCenter.registerProcessor(deepSeekProcessor, false);

  // Register Google News Processor (B4: DISABLED — demo/testing only, must not be
  // in the default-on profile or it claims lane work it cannot fulfil).
  taskCenter.registerProcessor(googleNewsProcessor, false);

  // Register Web-AI Translate Processor (B4: ENABLED). Advertises capability
  // ai_translate (remote_fast lane); it is the sole ai_translate owner (B18).
  taskCenter.registerProcessor(webAiTranslateProcessor, true);

  // Register ChatGPT / Gemini web-chat processors (DISABLED by default, opt-in).
  // Routed by task_type (chatgpt_chat / gemini_chat) on their own lanes; they
  // drive the live browser tab to send a prompt and capture text + audio.
  taskCenter.registerProcessor(chatGptProcessor, false);
  taskCenter.registerProcessor(geminiProcessor, false);

  console.log('[TaskCenter] Processors initialized');
}

/**
 * Get list of available processors
 */
export function getAvailableProcessors() {
  return taskCenter.getAllProcessors().map((processor) => ({
    type: processor.processorType,
    name: processor.processorName,
  }));
}
