/**
 * Bing Dictionary Processor
 * Wraps BingDictionaryWorkerService to implement ITaskProcessor interface
 * Under 150 lines
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import { bingDictionaryWorkerService } from '../../bing-dictionary-worker-service';

/**
 * Bing Dictionary Task Processor
 * Handles dictionary translation tasks from backend
 */
class BingDictionaryProcessor implements ITaskProcessor {
  readonly processorType = 'bing_dictionary';
  readonly processorName = 'Bing Dictionary Translation';

  /**
   * Start the processor
   */
  async start(config: ProcessorConfig): Promise<void> {
    console.log('[BingProcessor] Starting Bing Dictionary Processor');

    await bingDictionaryWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Bing Translation Worker',
      pollInterval: config.pollInterval || 5,
      heartbeatInterval: config.heartbeatInterval || 60,
      batchSize: config.batchSize || 5,
      tabCount: config.tabCount || 3,
      targetLanguage: config.targetLanguage || 'zh',
    });

    console.log('[BingProcessor] Bing Dictionary Processor started');
  }

  /**
   * Stop the processor
   */
  stop(): void {
    console.log('[BingProcessor] Stopping Bing Dictionary Processor');
    bingDictionaryWorkerService.stop();
    console.log('[BingProcessor] Bing Dictionary Processor stopped');
  }

  /**
   * Get processor status
   */
  getStatus(): ProcessorStatus {
    const serviceStatus = bingDictionaryWorkerService.getStatus();

    return {
      isRunning: serviceStatus.isRunning,
      stats: {
        pending: serviceStatus.stats.pending,
        translated: serviceStatus.stats.translated,
        failed: serviceStatus.stats.failed,
        invalid: serviceStatus.stats.invalid,
        lastRun: serviceStatus.stats.lastRun,
        workerId: serviceStatus.stats.workerId,
        isOnline: serviceStatus.stats.isOnline,
        queueTotal: serviceStatus.stats.queueTotal,
        newTasks: serviceStatus.stats.newTasks,
        duplicateTasks: serviceStatus.stats.duplicateTasks,
        activeTabs: serviceStatus.stats.activeTabs,
      },
    };
  }

  /**
   * Check if this processor can handle a specific task type
   */
  canHandle(taskType: string): boolean {
    return (
      taskType === 'bing_dictionary' ||
      taskType === 'dictionary_translation' ||
      taskType === 'word_translation'
    );
  }
}

// Singleton instance
export const bingDictionaryProcessor = new BingDictionaryProcessor();
