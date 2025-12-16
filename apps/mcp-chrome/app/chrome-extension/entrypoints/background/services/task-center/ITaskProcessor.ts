/**
 * Task Processor Interface
 * Defines the contract for all task processors (Bing Dictionary, DeepSeek, etc.)
 * Under 100 lines
 */

import { Task } from '../../api/WorkerApiClient';

export interface ProcessorConfig {
  apiUrl: string;
  [key: string]: any;
}

export interface ProcessorStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  queueTotal: number;
  newTasks: number;
  duplicateTasks: number;
  [key: string]: any; // Allow additional custom stats
}

export interface ProcessorStatus {
  isRunning: boolean;
  stats: ProcessorStats;
}

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
