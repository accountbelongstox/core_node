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
import { notebookLmProcessor } from './processors/NotebookLmProcessor';
import { geminiImageProcessor } from './processors/GeminiImageProcessor';
import { promptTranslateWebProcessor } from './processors/PromptTranslateWebProcessor';
import { wordValidityWebProcessor } from './processors/WordValidityWebProcessor';

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

  // Register NotebookLM / Gemini-Image processors (DISABLED by default,
  // opt-in): Task Center v3 lanes (remote_notebooklm / remote_gemini). They
  // drive the live notebooklm.google.com / gemini.google.com tab and are the
  // autonomous consumers for tasks the AppQyV1AiPromptFanoutTask timer (and
  // the manual /task/enqueue endpoint) creates on those lanes.
  taskCenter.registerProcessor(notebookLmProcessor, false);
  taskCenter.registerProcessor(geminiImageProcessor, false);

  // Register Prompt-Translate Web Processor (DISABLED by default, opt-in): the
  // chrome fulfiller of the cross-stack `prompt_translation` pipeline — drives
  // the preferred web provider (settings) and returns {english,cleaned,variants}.
  taskCenter.registerProcessor(promptTranslateWebProcessor, false);

  // Register Word-Validity Web Processor (DISABLED by default, opt-in): drives a
  // web LLM (Gemini/DeepSeek/ChatGPT) to classify untranslated+unchecked words
  // valid/invalid on the dedicated remote_validity lane, so translation skips junk.
  taskCenter.registerProcessor(wordValidityWebProcessor, false);

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
