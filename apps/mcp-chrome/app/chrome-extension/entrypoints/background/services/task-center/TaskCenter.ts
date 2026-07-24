/**
 * Task Center - Unified State Center
 * Persistent task management system initialized at startup
 * All processors are registered via hooks and persist throughout lifecycle
 * Under 350 lines
 */

import type {
  ITaskProcessor,
  ProcessorRegistryEntry,
  ProcessorConfig,
  ProcessorStatus,
} from './ITaskProcessor';
// Canonical control-protocol types (shared with the popup) live in one module.
import type {
  TaskCenterConfig,
  TaskCenterStats,
  BackendHealth,
} from '@/utils/task-center-types';

// Re-export so existing importers of './TaskCenter' keep resolving these.
export type {
  TaskCenterConfig,
  TaskCenterStats,
  BackendHealth,
} from '@/utils/task-center-types';

export type TaskCenterEventType = 'start' | 'stop' | 'processor_registered' | 'processor_started' | 'processor_stopped' | 'processor_failed';

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

    // Normalize the optional per-processor config map up front so lane
    // activation never assumes its presence (the popup may send only
    // {apiUrl, activeCapabilities}). Single guard, one place.
    if (!config.processors) config.processors = {};
    this.config = config;
    console.log('[TaskCenter] 🚀 Activating Task Center...');

    // Apply the optional enabledProcessors allowlist: when provided and
    // non-empty it becomes authoritative — each processor is enabled iff it is
    // listed, so checked lanes run even if registered disabled by default, and
    // unlisted lanes stay off. Absent/empty => keep current per-processor state.
    const allow =
      Array.isArray(config.enabledProcessors) && config.enabledProcessors.length > 0
        ? new Set(config.enabledProcessors)
        : null;
    if (allow) {
      for (const [processorType, entry] of this.registry.entries()) {
        entry.enabled = allow.has(processorType);
      }
    }

    // Track each start() promise alongside its processorType so allSettled
    // results can be correlated. Event emission is folded into the result
    // inspection below (no separate unhandled .then() derived promise).
    const startEntries: { processorType: string; promise: Promise<void> }[] = [];
    const failedProcessors: string[] = [];

    for (const [processorType, entry] of this.registry.entries()) {
      if (!entry.enabled) {
        console.log(`[TaskCenter] ⏸  Processor ${processorType} disabled, skipping`);
        continue;
      }

      const processorConfig = config.processors?.[processorType] || { apiUrl: config.apiUrl };

      try {
        console.log(`[TaskCenter] ▶️  Activating processor: ${processorType}`);
        const promise = entry.processor.start(processorConfig);
        startEntries.push({ processorType, promise });
      } catch (error: any) {
        // Synchronous throw (defensive - start() is async so rejections land in
        // allSettled below, but guard anyway).
        console.error(`[TaskCenter] ❌ Failed to activate processor ${processorType}:`, error);
        failedProcessors.push(processorType);
        this.emitEvent({
          type: 'processor_failed',
          processorType,
          timestamp: Date.now(),
        });
      }
    }

    const results = await Promise.allSettled(startEntries.map((e) => e.promise));
    let startedCount = 0;
    results.forEach((result, i) => {
      const { processorType } = startEntries[i];
      if (result.status === 'fulfilled') {
        startedCount++;
        this.emitEvent({
          type: 'processor_started',
          processorType,
          timestamp: Date.now(),
        });
      } else {
        console.error(
          `[TaskCenter] ❌ Processor ${processorType} failed to start:`,
          result.reason,
        );
        failedProcessors.push(processorType);
        this.emitEvent({
          type: 'processor_failed',
          processorType,
          timestamp: Date.now(),
        });
      }
    });

    // Starting the selected production lanes is transactional. A partial start
    // would make the capability checkboxes claim more work than is actually
    // being processed, so stop every lane started in this attempt and let the
    // caller surface one actionable failure.
    if (failedProcessors.length > 0 || startedCount === 0) {
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const { processorType } = startEntries[index];
        const entry = this.registry.get(processorType);
        try {
          if (entry?.processor.getStatus().isRunning) entry.processor.stop();
        } catch (error) {
          console.error(`[TaskCenter] Failed to roll back processor ${processorType}:`, error);
        }
      });
      throw new Error(
        failedProcessors.length > 0
          ? `Failed to start processors: ${failedProcessors.join(', ')}`
          : 'No processors were selected for startup',
      );
    }

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
      console.warn('[TaskCenter] Center flag is stopped; cleaning up any residual processors');
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
    backend: BackendHealth;
  } {
    const stats: TaskCenterStats = {
      totalProcessors: this.registry.size,
      runningProcessors: 0,
      totalPending: 0,
      totalTranslated: 0,
      totalFailed: 0,
      processors: {},
    };

    // Backend aggregation across the RUNNING workers only (a stopped worker's
    // stale reachability is irrelevant). A worker exposes backendOnline (the
    // SimpleWorkerBase health signal); workers without it fall back to isOnline.
    let anyRunningReachable = false;
    let worstFailures = -1;
    let worstError: string | null = null;
    let latestRequestAt: number | null = null;

    for (const [processorType, entry] of this.registry.entries()) {
      const status = entry.processor.getStatus();
      stats.processors[processorType] = status;

      if (status.isRunning) {
        stats.runningProcessors++;

        const s: any = status.stats;
        const reachable =
          typeof s.backendOnline === 'boolean' ? s.backendOnline : s.isOnline === true;
        if (reachable) anyRunningReachable = true;

        const failures = typeof s.consecutiveFailures === 'number' ? s.consecutiveFailures : 0;
        if (failures > worstFailures) {
          worstFailures = failures;
          worstError = typeof s.lastError === 'string' ? s.lastError : null;
        }
        if (typeof s.lastRequestAt === 'number') {
          latestRequestAt = latestRequestAt === null ? s.lastRequestAt : Math.max(latestRequestAt, s.lastRequestAt);
        }
      }

      stats.totalPending += status.stats.pending;
      stats.totalTranslated += status.stats.translated;
      stats.totalFailed += status.stats.failed;
    }

    // Nothing running => nothing is failing; report online.
    const backend: BackendHealth = {
      online: stats.runningProcessors === 0 ? true : anyRunningReachable,
      lastError: worstError,
      lastRequestAt: latestRequestAt,
      consecutiveFailures: worstFailures < 0 ? 0 : worstFailures,
    };

    return {
      isRunning: this.isRunning,
      stats,
      backend,
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
