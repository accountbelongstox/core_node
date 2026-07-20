/**
 * Task Processor Interface
 * Defines the contract for all task processors (Bing Dictionary, DeepSeek, etc.)
 * Under 100 lines
 */

import { Task } from '../../api/WorkerApiClient';

// Processor-level shapes are centralized in utils/task-center-types.ts so the
// popup and background share ONE definition. Re-exported here for the many
// existing importers of './ITaskProcessor'.
export type {
  ProcessorConfig,
  ProcessorStats,
  ProcessorStatus,
} from '@/utils/task-center-types';
import type { ProcessorConfig, ProcessorStatus } from '@/utils/task-center-types';

/**
 * Task Processor Interface
 * All task processors must implement this interface
 */
export interface ITaskProcessor {
  /**
   * Unique identifier for this processor type
   */
  readonly processorType: string;

  /**
   * Human-readable name for this processor
   */
  readonly processorName: string;

  /**
   * Start the processor
   */
  start(config: ProcessorConfig): Promise<void>;

  /**
   * Stop the processor
   */
  stop(): void;

  /**
   * Get processor status
   */
  getStatus(): ProcessorStatus;

  /**
   * Check if this processor can handle a specific task type
   */
  canHandle(taskType: string): boolean;

  /**
   * Process a single task (optional, for manual task processing)
   */
  processTask?(task: Task): Promise<void>;
}

/**
 * Task Processor Registry Entry
 */
export interface ProcessorRegistryEntry {
  processor: ITaskProcessor;
  config?: ProcessorConfig;
  enabled: boolean;
}
