export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

type Listener = (entries: LogEntry[]) => void;

class AppLogger {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private counter = 0;

  getEntries(): LogEntry[] {
    return this.entries;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => {
      this.listeners.delete(listener);
    };
  }

  info(message: string): void {
    this.log('info', message);
  }

  success(message: string): void {
    this.log('success', message);
  }

  warning(message: string): void {
    this.log('warning', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  private log(level: LogLevel, message: string): void {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${this.counter++}`,
      level,
      message,
      timestamp: Date.now()
    };

    this.entries = [entry, ...this.entries].slice(0, 100);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.entries);
    }
  }
}

export const appLogger = new AppLogger();
