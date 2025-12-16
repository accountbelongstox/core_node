/**
 * Task Center - Unified State Center
 * Persistent task management system initialized at startup
 * All processors are registered via hooks and persist throughout lifecycle
 * Under 350 lines
 */

import type {
  ITaskProcessor,
  ProcessorConfig,
  ProcessorRegistryEntry,
  ProcessorStatus,
} from './ITaskProcessor';

export interface TaskCenterConfig {
  apiUrl: string;
  pollInterval?: number;
  processors: {
    [processorType: string]: ProcessorConfig;
  };
}

export interface TaskCenterStats {
  totalProcessors: number;
  runningProcessors: number;
  totalPending: number;
  totalTranslated: number;
  totalFailed: number;
  processors: {
    [processorType: string]: ProcessorStatus;
  };
}

export type TaskCenterEventType = 'start' | 'stop' | 'processor_registered' | 'processor_started' | 'processor_stopped';

export interface TaskCenterEvent {
  type: TaskCenterEventType;
  processorType?: string;
  timestamp: number;
}

export type TaskCenterEventListener = (event: TaskCenterEvent) => void;

/**
 * Task Center Service - Unified State Center
 * Initialized once at background script startup
 * Manages state of all task processors
 */
class TaskCenterService {
  private isRunning = false;
  private initialized = false;
  private registry = new Map<string, ProcessorRegistryEntry>();
  private config: TaskCenterConfig | null = null;
  private eventListeners: TaskCenterEventListener[] = [];

  /**
   * Initialize the Task Center (called once at startup)
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('[TaskCenter] Already initialized');
      return;
    }

    console.log('[TaskCenter] Initializing Unified State Center...');
    this.initialized = true;
    console.log('[TaskCenter] State Center ready');
  }

  /**
   * Register a task processor (Hook)
   * Processors are registered once and persist throughout lifecycle
   */
  registerProcessor(processor: ITaskProcessor, enabled = true): void {
    const { processorType } = processor;

    if (this.registry.has(processorType)) {
      console.warn(`[TaskCenter] Processor ${processorType} already registered, skipping...`);
      return;
    }

    this.registry.set(processorType, {
      processor,
      enabled,
    });

    console.log(`[TaskCenter] ✓ Hooked processor: ${processorType} (${processor.processorName})`);

    this.emitEvent({
      type: 'processor_registered',
      processorType,
      timestamp: Date.now(),
    });
  }

  /**
   * Add event listener
   */
  on(listener: TaskCenterEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: TaskCenterEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event
   */
  private emitEvent(event: TaskCenterEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[TaskCenter] Event listener error:', error);
      }
    }
  }

  /**
   * Get a registered processor
   */
  getProcessor(processorType: string): ITaskProcessor | null {
    const entry = this.registry.get(processorType);
    return entry ? entry.processor : null;
  }

  /**
   * Get all registered processors
   */
  getAllProcessors(): ITaskProcessor[] {
    return Array.from(this.registry.values()).map((entry) => entry.processor);
  }

  /**
   * Enable a processor
   */
  enableProcessor(processorType: string): void {
    const entry = this.registry.get(processorType);
    if (entry) {
      entry.enabled = true;
      console.log(`[TaskCenter] Enabled processor: ${processorType}`);
    }
  }

  /**
   * Disable a processor
   */
  disableProcessor(processorType: string): void {
    const entry = this.registry.get(processorType);
    if (entry) {
      // Stop if running
      if (entry.processor.getStatus().isRunning) {
        entry.processor.stop();
      }
      entry.enabled = false;
      console.log(`[TaskCenter] Disabled processor: ${processorType}`);
    }
  }

  /**
   * Start Task Center (activate all enabled processors)
   * This changes state only - processors remain hooked
   */
  async startAll(config: TaskCenterConfig): Promise<void> {
    if (!this.initialized) {
      throw new Error('Task Center not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.warn('[TaskCenter] Task Center already running');
      return;
    }

    this.config = config;
    console.log('[TaskCenter] 🚀 Activating Task Center...');

    const startPromises: Promise<void>[] = [];

    for (const [processorType, entry] of this.registry.entries()) {
      if (!entry.enabled) {
        console.log(`[TaskCenter] ⏸  Processor ${processorType} disabled, skipping`);
        continue;
      }

      const processorConfig = config.processors[processorType] || { apiUrl: config.apiUrl };

      try {
        console.log(`[TaskCenter] ▶️  Activating processor: ${processorType}`);
        const startPromise = entry.processor.start(processorConfig);
        startPromises.push(startPromise);

        // Emit event after start
        startPromise.then(() => {
          this.emitEvent({
            type: 'processor_started',
            processorType,
            timestamp: Date.now(),
          });
        });
      } catch (error: any) {
        console.error(`[TaskCenter] ❌ Failed to activate processor ${processorType}:`, error);
      }
    }

    await Promise.allSettled(startPromises);

    this.isRunning = true;
    this.emitEvent({
      type: 'start',
      timestamp: Date.now(),
    });

    console.log('[TaskCenter] ✅ Task Center activated');
  }

  /**
   * Stop Task Center (deactivate all processors)
   * This changes state only - processors remain hooked
   */
  stopAll(): void {
    if (!this.isRunning) {
      console.warn('[TaskCenter] Task Center not running');
      return;
    }

    console.log('[TaskCenter] 🛑 Deactivating Task Center...');

    for (const [processorType, entry] of this.registry.entries()) {
      try {
        if (entry.processor.getStatus().isRunning) {
          console.log(`[TaskCenter] ⏸️  Deactivating processor: ${processorType}`);
          entry.processor.stop();

          this.emitEvent({
            type: 'processor_stopped',
            processorType,
            timestamp: Date.now(),
          });
        }
      } catch (error: any) {
        console.error(`[TaskCenter] ❌ Failed to deactivate processor ${processorType}:`, error);
      }
    }

    this.isRunning = false;
    this.emitEvent({
      type: 'stop',
      timestamp: Date.now(),
    });

    console.log('[TaskCenter] ⏹️  Task Center deactivated (processors remain hooked)');
  }

  /**
   * Start a specific processor
   */
  async startProcessor(processorType: string, config?: ProcessorConfig): Promise<void> {
    const entry = this.registry.get(processorType);

    if (!entry) {
      throw new Error(`Processor ${processorType} not registered`);
    }

    if (!entry.enabled) {
      throw new Error(`Processor ${processorType} is disabled`);
    }

    const processorConfig = config || entry.config || { apiUrl: this.config?.apiUrl || '' };

    console.log(`[TaskCenter] Starting processor: ${processorType}`);
    await entry.processor.start(processorConfig);
  }

  /**
   * Stop a specific processor
   */
  stopProcessor(processorType: string): void {
    const entry = this.registry.get(processorType);

    if (!entry) {
      throw new Error(`Processor ${processorType} not registered`);
    }

    console.log(`[TaskCenter] Stopping processor: ${processorType}`);
    entry.processor.stop();
  }

  /**
   * Get Task Center status
   */
  getStatus(): {
    isRunning: boolean;
    stats: TaskCenterStats;
  } {
    const stats: TaskCenterStats = {
      totalProcessors: this.registry.size,
      runningProcessors: 0,
      totalPending: 0,
      totalTranslated: 0,
      totalFailed: 0,
      processors: {},
    };

    for (const [processorType, entry] of this.registry.entries()) {
      const status = entry.processor.getStatus();
      stats.processors[processorType] = status;

      if (status.isRunning) {
        stats.runningProcessors++;
      }

      stats.totalPending += status.stats.pending;
      stats.totalTranslated += status.stats.translated;
      stats.totalFailed += status.stats.failed;
    }

    return {
      isRunning: this.isRunning,
      stats,
    };
  }

  /**
   * Get processor status
   */
  getProcessorStatus(processorType: string): ProcessorStatus | null {
    const entry = this.registry.get(processorType);
    return entry ? entry.processor.getStatus() : null;
  }

  /**
   * Check if Task Center is running
   */
  isTaskCenterRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const taskCenter = new TaskCenterService();
