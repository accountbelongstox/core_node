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

  private applyProcessorAllowlist(enabledProcessors: string[] | undefined): void {
    if (!Array.isArray(enabledProcessors)) return;
    const allow = new Set(enabledProcessors);
    for (const [processorType, entry] of this.registry.entries()) {
      entry.enabled = allow.has(processorType);
    }
  }

  private processorConfig(processorType: string, config: TaskCenterConfig): ProcessorConfig {
    return config.processors?.[processorType] || { apiUrl: config.apiUrl };
  }

  private describeProcessorError(error: any): string {
    const message = error?.message || String(error ?? 'unknown error');
    const status = error?.statusCode ?? error?.status;
    return status ? `${message} (HTTP ${status})` : message;
  }

  /**
   * Start Task Center and activate its explicitly enabled processors.
   * An empty allowlist is a valid observer-only runtime.
   */
  async startAll(config: TaskCenterConfig): Promise<void> {
    if (!this.initialized) {
      throw new Error('Task Center not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      const enabledProcessors = Array.isArray(config.enabledProcessors)
        ? config.enabledProcessors
        : Array.from(this.registry.entries())
            .filter(([, entry]) => entry.enabled)
            .map(([processorType]) => processorType);
      await this.syncProcessors(enabledProcessors, config);
      return;
    }

    const normalizedConfig: TaskCenterConfig = {
      ...config,
      processors: { ...(config.processors || {}) },
      enabledProcessors: Array.isArray(config.enabledProcessors)
        ? [...config.enabledProcessors]
        : undefined,
    };
    this.config = normalizedConfig;
    console.log('[TaskCenter] 🚀 Activating Task Center...');

    this.applyProcessorAllowlist(normalizedConfig.enabledProcessors);

    // Track each start() promise alongside its processorType so allSettled
    // results can be correlated. Event emission is folded into the result
    // inspection below (no separate unhandled .then() derived promise).
    const startEntries: { processorType: string; promise: Promise<void> }[] = [];
    const failedProcessors: string[] = [];
    const failureReasons: Record<string, string> = {};

    for (const [processorType, entry] of this.registry.entries()) {
      if (!entry.enabled) {
        console.log(`[TaskCenter] ⏸  Processor ${processorType} disabled, skipping`);
        continue;
      }

      const processorConfig = this.processorConfig(processorType, normalizedConfig);

      try {
        console.log(`[TaskCenter] ▶️  Activating processor: ${processorType}`);
        const promise = entry.processor.start(processorConfig);
        startEntries.push({ processorType, promise });
      } catch (error: any) {
        // Synchronous throw (defensive - start() is async so rejections land in
        // allSettled below, but guard anyway).
        console.error(`[TaskCenter] ❌ Failed to activate processor ${processorType}:`, error);
        failedProcessors.push(processorType);
        failureReasons[processorType] = this.describeProcessorError(error);
        this.emitEvent({
          type: 'processor_failed',
          processorType,
          timestamp: Date.now(),
        });
      }
    }

    const results = await Promise.allSettled(startEntries.map((e) => e.promise));
    results.forEach((result, i) => {
      const { processorType } = startEntries[i];
      if (result.status === 'fulfilled') {
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
        failureReasons[processorType] = this.describeProcessorError(result.reason);
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
    if (failedProcessors.length > 0) {
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
      throw new Error(`Failed to start processors: ${
        failedProcessors
          .map((type) => (failureReasons[type] ? `${type} — ${failureReasons[type]}` : type))
          .join('; ')
      }`);
    }

    this.isRunning = true;
    this.emitEvent({
      type: 'start',
      timestamp: Date.now(),
    });

    console.log('[TaskCenter] ✅ Task Center activated');
  }

  async syncProcessors(enabledProcessors: string[], config: TaskCenterConfig): Promise<void> {
    const normalizedConfig: TaskCenterConfig = {
      ...config,
      processors: { ...(config.processors || {}) },
      enabledProcessors: [...enabledProcessors],
    };
    if (!this.isRunning) {
      await this.startAll(normalizedConfig);
      return;
    }

    const allow = new Set(enabledProcessors);
    const previousStates = new Map<string, { enabled: boolean; running: boolean }>();
    let startingProcessor: string | null = null;
    for (const [processorType, entry] of this.registry.entries()) {
      previousStates.set(processorType, {
        enabled: entry.enabled,
        running: entry.processor.getStatus().isRunning,
      });
    }

    try {
      for (const [processorType, entry] of this.registry.entries()) {
        if (!allow.has(processorType)) continue;
        entry.enabled = true;
        if (entry.processor.getStatus().isRunning) continue;
        startingProcessor = processorType;
        await entry.processor.start(this.processorConfig(processorType, normalizedConfig));
        this.emitEvent({
          type: 'processor_started',
          processorType,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      for (const [processorType, entry] of this.registry.entries()) {
        const previous = previousStates.get(processorType);
        if (!previous) continue;
        if (!previous.running && entry.processor.getStatus().isRunning) entry.processor.stop();
        entry.enabled = previous.enabled;
      }
      if (startingProcessor) {
        this.emitEvent({
          type: 'processor_failed',
          processorType: startingProcessor,
          timestamp: Date.now(),
        });
      }
      throw new Error(
        `Failed to start processor ${startingProcessor || 'unknown'}: ${this.describeProcessorError(error)}`,
      );
    }

    for (const [processorType, entry] of this.registry.entries()) {
      if (allow.has(processorType)) continue;
      const wasRunning = entry.processor.getStatus().isRunning;
      this.disableProcessor(processorType);
      if (wasRunning) {
        this.emitEvent({
          type: 'processor_stopped',
          processorType,
          timestamp: Date.now(),
        });
      }
    }
    this.config = normalizedConfig;
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
