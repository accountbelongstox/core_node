/**
 * Initialize Task Processors
 * Registers all available processors to Task Center
 * Under 50 lines
 */

import { taskCenter } from './TaskCenter';
import { bingDictionaryProcessor } from './processors/BingDictionaryProcessor';
import { deepSeekProcessor } from './processors/DeepSeekProcessor';

/**
 * Initialize and register all task processors
 */
export function initializeProcessors(): void {
  console.log('[TaskCenter] Initializing processors...');

  // Register Bing Dictionary Processor (enabled by default)
  taskCenter.registerProcessor(bingDictionaryProcessor, true);

  // Register DeepSeek Processor (disabled by default, placeholder)
  taskCenter.registerProcessor(deepSeekProcessor, false);

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
