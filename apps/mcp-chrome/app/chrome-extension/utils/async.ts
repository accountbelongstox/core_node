export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, timeoutMs);

  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

function raceWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutOperation = new Promise<T>((resolve, reject) => {
    timeout = setTimeout(() => {
      try {
        resolve(onTimeout());
      } catch (error) {
        reject(error);
      }
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutOperation]).finally(() => {
    if (timeout !== null) clearTimeout(timeout);
  });
}

export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  return raceWithTimeout(operation, timeoutMs, () => {
    throw new Error(errorMessage);
  });
}

export function withTimeoutFallback<T>(
  operation: Promise<T>,
  timeoutMs: number,
  createFallback: () => T,
): Promise<T> {
  return raceWithTimeout(operation, timeoutMs, createFallback);
}

export class IntervalController {
  private timer: ReturnType<typeof setInterval> | null = null;

  get isRunning(): boolean {
    return this.timer !== null;
  }

  start(callback: () => void, intervalMs: number): void {
    if (this.timer !== null) return;
    this.timer = setInterval(callback, intervalMs);
  }

  restart(callback: () => void, intervalMs: number): void {
    this.stop();
    this.start(callback, intervalMs);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

export class TimeoutController {
  private timer: ReturnType<typeof setTimeout> | null = null;

  get isScheduled(): boolean {
    return this.timer !== null;
  }

  schedule(callback: () => void, delayMs: number): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      callback();
    }, delayMs);
  }

  restart(callback: () => void, delayMs: number): void {
    this.cancel();
    this.schedule(callback, delayMs);
  }

  cancel(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let releaseCurrent!: () => void;
    let released = false;
    const previous = this.tail;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    this.tail = previous.then(() => current, () => current);
    await previous.catch(() => undefined);

    return () => {
      if (released) return;
      released = true;
      releaseCurrent();
    };
  }
}

abstract class PromiseController<T> {
  private operation: Promise<T> | null = null;
  private running = false;

  protected constructor(private readonly retainOnSuccess: boolean) {}

  get isRunning(): boolean {
    return this.running;
  }

  get current(): Promise<T> | null {
    return this.operation;
  }

  run(factory: () => Promise<T>): Promise<T> {
    if (this.operation) return this.operation;

    const operation = Promise.resolve().then(factory);
    this.operation = operation;
    this.running = true;
    void operation.then(
      () => this.finish(operation, true),
      () => this.finish(operation, false),
    );
    return operation;
  }

  reset(): void {
    this.operation = null;
    this.running = false;
  }

  private finish(operation: Promise<T>, succeeded: boolean): void {
    if (this.operation !== operation) return;
    this.running = false;
    if (!succeeded || !this.retainOnSuccess) this.operation = null;
  }
}

export class AsyncOperationController<T> extends PromiseController<T> {
  constructor() {
    super(false);
  }
}

export class InitializationController<T> extends PromiseController<T> {
  constructor() {
    super(true);
  }

  get isInitialized(): boolean {
    return this.current !== null && !this.isRunning;
  }
}
