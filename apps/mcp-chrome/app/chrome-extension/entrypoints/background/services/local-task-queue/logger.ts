/**
 * Task Queue Logger System
 * Centralized logging system that stores logs and broadcasts to UI
 */

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry interface
 */
export interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: number;
  source: string; // Component/service name
  message: string;
  details?: any; // Additional context
}

/**
 * Queue Logger
 * Singleton logger that stores logs and broadcasts to popup
 */
class QueueLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Keep last 500 logs
  private logListeners = new Set<(log: LogEntry) => void>();

  /**
   * Log debug message
   */
  debug(source: string, message: string, details?: any): void {
    this.addLog(LogLevel.DEBUG, source, message, details);
  }

  /**
   * Log info message
   */
  info(source: string, message: string, details?: any): void {
    this.addLog(LogLevel.INFO, source, message, details);
  }

  /**
   * Log warning message
   */
  warn(source: string, message: string, details?: any): void {
    this.addLog(LogLevel.WARN, source, message, details);
    console.warn(`[${source}] ${message}`, details);
  }

  /**
   * Log error message
   */
  error(source: string, message: string, details?: any): void {
    this.addLog(LogLevel.ERROR, source, message, details);
    console.error(`[${source}] ${message}`, details);
  }

  /**
   * Add log entry
   */
  private addLog(level: LogLevel, source: string, message: string, details?: any): void {
    const log: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      level,
      timestamp: Date.now(),
      source,
      message,
      details,
    };

    // Add to logs array
    this.logs.push(log);

    // Trim old logs if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.logListeners.forEach(listener => {
      try {
        listener(log);
      } catch (error) {
        console.error('[QueueLogger] Listener error:', error);
      }
    });

    // Broadcast to popup (non-blocking)
    this.broadcastLog(log);

    // Console output for debug/info (optional)
    if (level === LogLevel.DEBUG || level === LogLevel.INFO) {
      console.log(`[${source}] ${message}`, details);
    }
  }

  /**
   * Broadcast log to popup
   */
  private broadcastLog(log: LogEntry): void {
    try {
      chrome.runtime.sendMessage({
        type: 'QUEUE_LOG',
        log,
      });
    } catch (error) {
      // No receivers, ignore
    }
  }

  /**
   * Subscribe to logs
   */
  subscribe(listener: (log: LogEntry) => void): () => void {
    this.logListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.logListeners.delete(listener);
    };
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by source
   */
  getLogsBySource(source: string): LogEntry[] {
    return this.logs.filter(log => log.source === source);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    bySources: Record<string, number>;
  } {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
    };

    const bySources: Record<string, number> = {};

    this.logs.forEach(log => {
      byLevel[log.level]++;

      if (!bySources[log.source]) {
        bySources[log.source] = 0;
      }
      bySources[log.source]++;
    });

    return {
      total: this.logs.length,
      byLevel,
      bySources,
    };
  }
}

// Export singleton instance
export const queueLogger = new QueueLogger();
