/**
 * ComputeScheduler - the one entry for compute-heavy work (TTS, OCR, ...).
 *
 * Routing: pycore online -> direct call; pycore offline, Laravel online -> submit to Laravel
 * (queued or `pycore_unavailable`); both offline -> the job stays pending in the journal.
 * Every submission of a job carries the same idempotency key (job.id), so a failover or a
 * resubmission after a reload never duplicates work; the first result wins.
 *
 * State machine of a job:
 *   pending --(pycore up)--> submitted-pycore --done--> done
 *   pending --(laravel up)--> submitted-laravel --poll/event done--> done
 *   submitted-pycore --path drops--> pending (same key, other path may take it)
 *   submitted-laravel --pycore up after failoverAfterMs--> + shadow submission on pycore (first result wins)
 *   any --non-retryable failure or maxAttempts--> failed ; any --cancel--> failed(COMPUTE_CANCELLED)
 * A reload turns submitted-pycore back to pending; submitted-laravel resumes polling.
 */
import { Backoff } from '../../tasks/Backoff';
import { isNetworkLevelFailure } from '../../network/NetworkFailure';
import type { KeyValueStore } from '../../persistence/IdbKeyValueStore';
import { ComputeAvailability, SYSTEM_CLOCK, type ComputeClock } from './ComputeAvailability';
import {
  COMPUTE_DEFAULTS,
  COMPUTE_ERROR_CODES,
  COMPUTE_TERMINAL_STATES,
  type ComputeAttempt,
  type ComputeFailure,
  type ComputeJob,
  type ComputeKind,
  type ComputePath,
  type ComputeRunContext,
} from './ComputeTypes';

type FlightRole = 'primary' | 'shadow' | 'poll';
type FlightStop = 'path-down' | 'cancel' | 'superseded';

interface Flight {
  jobId: string;
  path: ComputePath;
  role: FlightRole;
  controller: AbortController;
  stop?: FlightStop;
}

interface Waiter {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class ComputeJobError extends Error {
  readonly code: string;
  readonly params: Record<string, unknown>;

  constructor(code: string, params: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ComputeJobError';
    this.code = code;
    this.params = params;
  }
}

export interface ComputeJobHandle<R> {
  id: string;
  /** Resolves with the result; rejects with a ComputeJobError. */
  result: Promise<R>;
  cancel: () => void;
}

export interface ComputeSchedulerOptions {
  availability: ComputeAvailability;
  journal: KeyValueStore<ComputeJob>;
  clock?: ComputeClock;
  newId?: () => string;
  parallel?: Record<ComputePath, number>;
  backoffMinMs?: number;
  backoffMaxMs?: number;
  failoverAfterMs?: number;
  pollMs?: number;
  retentionMs?: number;
  /** A thrown error that means the connection, not the job, failed (default: network-level failure). */
  isPathDrop?: (error: unknown) => boolean;
  /** Failure code, params and retryability of a thrown error. */
  describeError?: (error: unknown) => ComputeFailure;
}

function defaultDescribeError(error: unknown): ComputeFailure {
  const status = Number((error as { status?: unknown } | null)?.status);
  const code = (error as { code?: unknown } | null)?.code;
  return {
    code: typeof code === 'string' && code ? code : COMPUTE_ERROR_CODES.requestFailed,
    retryable: !Number.isFinite(status) || status === 0 || status === 429 || status >= 500,
  };
}

export class ComputeScheduler {
  private readonly kinds = new Map<string, ComputeKind<any, any>>();
  private readonly jobs = new Map<string, ComputeJob>();
  private readonly flights = new Map<string, Flight[]>();
  private readonly backoffs = new Map<string, Backoff>();
  private readonly waiters = new Map<string, Waiter>();
  private readonly results = new Map<string, unknown>();
  private readonly listeners = new Set<() => void>();
  private readonly clock: ComputeClock;
  private readonly availability: ComputeAvailability;
  private readonly journal: KeyValueStore<ComputeJob>;
  private readonly options: Required<Pick<ComputeSchedulerOptions, 'parallel' | 'backoffMinMs' | 'backoffMaxMs' | 'failoverAfterMs' | 'pollMs' | 'retentionMs'>>;
  private readonly newId: () => string;
  private readonly isPathDrop: (error: unknown) => boolean;
  private readonly describeError: (error: unknown) => ComputeFailure;
  private snapshot: ComputeJob[] = [];
  private lastAvailability = { pycore: false, laravel: false };
  private started: Promise<void> | null = null;
  private pumping = false;
  private pumpAgain = false;
  private wakeTimer: unknown = null;

  constructor(options: ComputeSchedulerOptions) {
    this.availability = options.availability;
    this.journal = options.journal;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.isPathDrop = options.isPathDrop ?? isNetworkLevelFailure;
    this.describeError = options.describeError ?? defaultDescribeError;
    this.options = {
      parallel: options.parallel ?? COMPUTE_DEFAULTS.parallel,
      backoffMinMs: options.backoffMinMs ?? COMPUTE_DEFAULTS.backoffMinMs,
      backoffMaxMs: options.backoffMaxMs ?? COMPUTE_DEFAULTS.backoffMaxMs,
      failoverAfterMs: options.failoverAfterMs ?? COMPUTE_DEFAULTS.failoverAfterMs,
      pollMs: options.pollMs ?? COMPUTE_DEFAULTS.pollMs,
      retentionMs: options.retentionMs ?? COMPUTE_DEFAULTS.retentionMs,
    };
  }

  register(kind: ComputeKind<any, any>): void {
    this.kinds.set(kind.kind, kind);
    this.pump();
  }

  /** Load the journal (jobs survive reloads and outages) and begin routing. */
  start(): Promise<void> {
    this.started ??= this.load();
    return this.started;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): ComputeJob[] => this.snapshot;

  get(id: string): ComputeJob | undefined {
    return this.jobs.get(id);
  }

  /** Submit a job; an existing id returns the existing job (idempotent). */
  submit<P, R>(kind: string, payload: P, options: { id?: string } = {}): ComputeJobHandle<R> {
    const id = options.id ?? this.newId();
    if (!this.jobs.has(id)) {
      const now = this.clock.now();
      this.jobs.set(id, {
        id, kind, payload, state: 'pending', attempts: 0, failures: 0,
        createdAt: now, updatedAt: now, nextAttemptAt: now, progress: 0,
      });
      this.commit(this.jobs.get(id)!);
    }
    void this.start();
    this.pump();
    return this.handle<R>(id);
  }

  /** A handle on a job (also for one restored from the journal). */
  handle<R>(id: string): ComputeJobHandle<R> {
    return {
      id,
      result: this.resultPromise<R>(id),
      cancel: () => this.cancel(id),
    };
  }

  /** The result of a done job: kept in memory this session, else loaded through its kind. */
  async resultOf<R>(id: string): Promise<R | undefined> {
    if (this.results.has(id)) return this.results.get(id) as R;
    const job = this.jobs.get(id);
    if (!job || job.state !== 'done' || !job.resultRef) return undefined;
    return this.kinds.get(job.kind)?.loadResult?.(job.resultRef) as Promise<R | undefined>;
  }

  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (!job || COMPUTE_TERMINAL_STATES.has(job.state)) return;
    this.stopFlights(id, 'cancel');
    this.fail(job, COMPUTE_ERROR_CODES.cancelled);
  }

  /** Run a failed job again from scratch (same key). */
  retry(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.state !== 'failed') return;
    this.backoffs.delete(id);
    this.update(job, {
      state: 'pending', failures: 0, nextAttemptAt: this.clock.now(), progress: 0,
      errorCode: undefined, errorParams: undefined, laravelRef: undefined, path: undefined, shadow: undefined,
    });
    this.pump();
  }

  forget(id: string): void {
    this.stopFlights(id, 'cancel');
    this.jobs.delete(id);
    this.results.delete(id);
    this.backoffs.delete(id);
    this.waiters.delete(id);
    void this.journal.delete(id);
    this.publish();
  }

  /** Event-driven pickup (queue-center push, Mercure): look at a queued job now. */
  wake(id?: string): void {
    const now = this.clock.now();
    this.jobs.forEach((job) => {
      if ((id === undefined || job.id === id) && job.state === 'submitted-laravel') job.lastPollAt = now - this.options.pollMs;
    });
    this.pump();
  }

  private async load(): Promise<void> {
    const stored = await this.journal.getAll();
    const now = this.clock.now();
    for (const job of stored) {
      if (this.jobs.has(job.id)) continue;
      const finishedTooLong = COMPUTE_TERMINAL_STATES.has(job.state) && now - job.updatedAt > this.options.retentionMs;
      if (finishedTooLong) {
        void this.journal.delete(job.id);
        continue;
      }
      // A direct flight does not survive a reload: the same key goes out again.
      const restored: ComputeJob = job.state === 'submitted-pycore'
        ? { ...job, state: 'pending', path: undefined, shadow: undefined, nextAttemptAt: now }
        : { ...job, shadow: undefined };
      this.jobs.set(job.id, restored);
      if (restored !== job) void this.journal.put(job.id, restored);
    }
    this.availability.start();
    this.lastAvailability = { ...this.availability.getSnapshot() };
    this.availability.subscribe(() => this.onAvailability());
    this.publish();
    this.pump();
  }

  private onAvailability(): void {
    const next = this.availability.getSnapshot();
    const now = this.clock.now();
    (['pycore', 'laravel'] as const).forEach((path) => {
      if (next[path] === this.lastAvailability[path]) return;
      if (!next[path]) {
        this.flights.forEach((list) => list.forEach((flight) => {
          if (flight.path !== path || flight.stop) return;
          this.stopFlight(flight, 'path-down');
          this.pathDown(flight);
        }));
      } else {
        // A path that came back is a new chance: backoffs of waiting jobs are cut short.
        this.jobs.forEach((job) => {
          if (job.state === 'pending') job.nextAttemptAt = Math.min(job.nextAttemptAt, now);
        });
      }
    });
    this.lastAvailability = { ...next };
    this.pump();
  }

  private pump(): void {
    if (!this.started) return;
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }
    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;
        this.dispatchReady();
      } while (this.pumpAgain);
    } finally {
      this.pumping = false;
    }
    this.scheduleWake();
  }

  private capacity(path: ComputePath): boolean {
    let running = 0;
    this.flights.forEach((list) => list.forEach((flight) => {
      if (flight.path === path && flight.role !== 'poll' && !flight.stop) running += 1;
    }));
    return running < this.options.parallel[path];
  }

  private hasFlight(id: string, role?: FlightRole): boolean {
    return (this.flights.get(id) ?? []).some((flight) => !flight.stop && (role === undefined || flight.role === role));
  }

  private choosePath(kind: ComputeKind<any, any>): ComputePath | null {
    const availability = this.availability.getSnapshot();
    const required = typeof kind.pycoreRequired === 'function' ? kind.pycoreRequired() : kind.pycoreRequired;
    if (required === false) return availability.laravel && kind.laravel && this.capacity('laravel') ? 'laravel' : null;
    if (availability.pycore && kind.pycore) return this.capacity('pycore') ? 'pycore' : null;
    if (availability.laravel && kind.laravel && this.capacity('laravel')) return 'laravel';
    return null;
  }

  private dispatchReady(): void {
    const now = this.clock.now();
    const availability = this.availability.getSnapshot();
    const ordered = [...this.jobs.values()].sort((left, right) => left.createdAt - right.createdAt);
    for (const job of ordered) {
      if (COMPUTE_TERMINAL_STATES.has(job.state)) continue;
      const kind = this.kinds.get(job.kind);
      if (!kind) continue;
      if (job.state === 'pending') {
        if (job.nextAttemptAt > now || this.hasFlight(job.id)) continue;
        const path = this.choosePath(kind);
        if (path) this.run(job, kind, path, 'primary');
        continue;
      }
      if (job.state !== 'submitted-laravel') continue;
      const pollDue = now - (job.lastPollAt ?? 0) >= this.options.pollMs;
      if (availability.laravel && kind.pollLaravel && pollDue && !this.hasFlight(job.id, 'poll')) {
        this.poll(job, kind);
      }
      const failoverDue = now - (job.submittedAt ?? now) >= this.options.failoverAfterMs;
      const pycoreRequired = typeof kind.pycoreRequired === 'function' ? kind.pycoreRequired() : kind.pycoreRequired;
      if (pycoreRequired !== false && availability.pycore && kind.pycore && failoverDue && !job.shadow
        && !this.hasFlight(job.id, 'shadow') && this.capacity('pycore')) {
        this.run(job, kind, 'pycore', 'shadow');
      }
    }
  }

  private scheduleWake(): void {
    if (this.wakeTimer !== null) this.clock.clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const now = this.clock.now();
    let at = Infinity;
    this.jobs.forEach((job) => {
      if (job.state === 'pending' && job.nextAttemptAt > now) at = Math.min(at, job.nextAttemptAt);
      if (job.state === 'submitted-laravel') {
        at = Math.min(at, (job.lastPollAt ?? now) + this.options.pollMs);
        if (!job.shadow) at = Math.min(at, (job.submittedAt ?? now) + this.options.failoverAfterMs);
      }
    });
    if (at === Infinity) return;
    this.wakeTimer = this.clock.setTimeout(() => {
      this.wakeTimer = null;
      this.pump();
    }, Math.max(at - now, 0) + 1);
  }

  private addFlight(job: ComputeJob, path: ComputePath, role: FlightRole): Flight {
    const flight: Flight = { jobId: job.id, path, role, controller: new AbortController() };
    this.flights.set(job.id, [...(this.flights.get(job.id) ?? []), flight]);
    return flight;
  }

  private removeFlight(id: string, flight: Flight): void {
    const rest = (this.flights.get(id) ?? []).filter((entry) => entry !== flight);
    if (rest.length) this.flights.set(id, rest);
    else this.flights.delete(id);
  }

  private stopFlight(flight: Flight, stop: FlightStop): void {
    flight.stop = stop;
    flight.controller.abort();
  }

  private stopFlights(id: string, stop: FlightStop, except?: Flight): void {
    (this.flights.get(id) ?? []).forEach((flight) => {
      if (flight !== except && !flight.stop) this.stopFlight(flight, stop);
    });
  }

  private context(job: ComputeJob, flight: Flight): ComputeRunContext {
    return {
      signal: flight.controller.signal,
      progress: (fraction) => {
        if (flight.stop || COMPUTE_TERMINAL_STATES.has(job.state)) return;
        job.progress = Math.max(job.progress, Math.min(1, fraction));
        this.publish();
      },
    };
  }

  private run(job: ComputeJob, kind: ComputeKind<any, any>, path: ComputePath, role: 'primary' | 'shadow'): void {
    const runner = path === 'pycore' ? kind.pycore : kind.laravel;
    if (!runner) return;
    const flight = this.addFlight(job, path, role);
    const now = this.clock.now();
    if (role === 'primary') {
      this.update(job, {
        state: path === 'pycore' ? 'submitted-pycore' : 'submitted-laravel',
        path, submittedAt: now, attempts: job.attempts + 1, shadow: undefined, unavailable: undefined,
      });
    } else {
      this.update(job, { shadow: path, attempts: job.attempts + 1 });
    }
    void (async () => {
      let attempt: ComputeAttempt<unknown> | null = null;
      let thrown: unknown = null;
      try {
        attempt = await runner(job, this.context(job, flight));
      } catch (error) {
        thrown = error ?? new Error('compute runner failed');
      }
      this.removeFlight(job.id, flight);
      if (COMPUTE_TERMINAL_STATES.has(job.state) || flight.stop) {
        this.pump();
        return;
      }
      if (thrown !== null || attempt === null) this.onThrown(job, kind, flight, thrown);
      else this.onAttempt(job, kind, flight, attempt);
      this.pump();
    })();
  }

  private poll(job: ComputeJob, kind: ComputeKind<any, any>): void {
    if (!kind.pollLaravel) return;
    const flight = this.addFlight(job, 'laravel', 'poll');
    job.lastPollAt = this.clock.now();
    void (async () => {
      let attempt: ComputeAttempt<unknown> | null = null;
      try {
        attempt = await kind.pollLaravel!(job, this.context(job, flight));
      } catch {
        attempt = null;
      }
      this.removeFlight(job.id, flight);
      if (!COMPUTE_TERMINAL_STATES.has(job.state) && !flight.stop && attempt) {
        if (attempt.status === 'done') void this.complete(job, kind, attempt.result, 'laravel');
        else if (attempt.status === 'failed') this.onQueuedTaskFailed(job, attempt.failure);
      }
      this.pump();
    })();
  }

  /** The availability of a flight's path dropped: its job is free for the other path at once (same key). */
  private pathDown(flight: Flight): void {
    const job = this.jobs.get(flight.jobId);
    if (!job || COMPUTE_TERMINAL_STATES.has(job.state) || flight.role === 'poll') return;
    if (flight.role === 'shadow') this.update(job, { shadow: undefined });
    else this.update(job, { state: 'pending', path: undefined, nextAttemptAt: this.clock.now() });
  }

  private onThrown(job: ComputeJob, kind: ComputeKind<any, any>, flight: Flight, error: unknown): void {
    if (this.isPathDrop(error)) {
      // The connection dropped before the availability noticed: retry later under the same key.
      if (flight.role === 'shadow') this.update(job, { shadow: undefined });
      else this.update(job, { state: 'pending', path: undefined, nextAttemptAt: this.clock.now() + this.backoff(job).next() });
      return;
    }
    this.onFailure(job, kind, flight.role, this.describeError(error));
  }

  private onAttempt(job: ComputeJob, kind: ComputeKind<any, any>, flight: Flight, attempt: ComputeAttempt<unknown>): void {
    if (attempt.status === 'done') {
      void this.complete(job, kind, attempt.result, flight.path);
    } else if (attempt.status === 'queued') {
      if (flight.role !== 'primary') return;
      const now = this.clock.now();
      this.update(job, {
        state: 'submitted-laravel', path: 'laravel', laravelRef: attempt.ref, lastPollAt: now + (attempt.retryAfterMs ?? 0),
        unavailable: attempt.info,
      });
    } else if (attempt.status === 'unavailable') {
      if (flight.role !== 'primary') return;
      const delay = attempt.retryAfterMs ?? this.backoff(job).next();
      this.update(job, {
        state: 'pending', path: undefined, unavailable: attempt.info ?? {}, nextAttemptAt: this.clock.now() + delay,
      });
    } else {
      this.onFailure(job, kind, flight.role, attempt.failure);
    }
  }

  private onQueuedTaskFailed(job: ComputeJob, failure: ComputeFailure): void {
    const kind = this.kinds.get(job.kind);
    // The queued task failed remotely: run the job again (other path or later) under the same key.
    this.update(job, { laravelRef: undefined });
    this.onFailure(job, kind ?? { kind: job.kind }, 'primary', failure);
  }

  private onFailure(job: ComputeJob, kind: ComputeKind<any, any>, role: FlightRole, failure: ComputeFailure): void {
    if (role === 'shadow') {
      this.update(job, { shadow: undefined });
      return;
    }
    const failures = job.failures + 1;
    const max = kind.maxAttempts ?? COMPUTE_DEFAULTS.maxAttempts;
    if (!failure.retryable) {
      this.update(job, { failures });
      this.fail(job, failure.code, failure.params);
    } else if (failures >= max) {
      this.update(job, { failures });
      this.fail(job, failure.code || COMPUTE_ERROR_CODES.maxAttempts, failure.params);
    } else {
      this.update(job, {
        state: 'pending', path: undefined, failures, errorCode: failure.code, errorParams: failure.params,
        nextAttemptAt: this.clock.now() + this.backoff(job).next(),
      });
    }
  }

  private backoff(job: ComputeJob): Backoff {
    let backoff = this.backoffs.get(job.id);
    if (!backoff) {
      backoff = new Backoff(this.options.backoffMinMs, this.options.backoffMaxMs);
      this.backoffs.set(job.id, backoff);
    }
    return backoff;
  }

  /** First result wins: later results of the other path are ignored. */
  private async complete(job: ComputeJob, kind: ComputeKind<any, any>, result: unknown, via: ComputePath): Promise<void> {
    if (COMPUTE_TERMINAL_STATES.has(job.state)) return;
    this.stopFlights(job.id, 'superseded');
    this.results.set(job.id, result);
    this.backoffs.delete(job.id);
    this.update(job, {
      state: 'done', resultVia: via, progress: 1, path: undefined, shadow: undefined,
      errorCode: undefined, errorParams: undefined, unavailable: undefined, laravelRef: undefined,
    });
    this.waiters.get(job.id)?.resolve(result);
    try {
      const ref = await kind.persistResult?.(job, result);
      if (ref) this.update(job, { resultRef: ref });
    } catch {
      // The result stays in memory; the journal keeps the done state without a reference.
    }
  }

  private fail(job: ComputeJob, code: string, params?: Record<string, unknown>): void {
    if (COMPUTE_TERMINAL_STATES.has(job.state)) return;
    this.stopFlights(job.id, 'superseded');
    this.update(job, { state: 'failed', errorCode: code, errorParams: params, path: undefined, shadow: undefined });
    this.waiters.get(job.id)?.reject(new ComputeJobError(code, params));
  }

  private resultPromise<R>(id: string): Promise<R> {
    const job = this.jobs.get(id);
    const existing = this.waiters.get(id);
    if (existing) return existing.promise as Promise<R>;
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => undefined);
    this.waiters.set(id, { promise, resolve, reject });
    if (job?.state === 'done') {
      void this.resultOf(id).then((value) => resolve(value));
    } else if (job?.state === 'failed') {
      reject(new ComputeJobError(job.errorCode ?? COMPUTE_ERROR_CODES.requestFailed, job.errorParams));
    }
    return promise as Promise<R>;
  }

  private update(job: ComputeJob, change: Partial<ComputeJob>): void {
    Object.assign(job, change, { updatedAt: this.clock.now() });
    this.commit(job);
  }

  private commit(job: ComputeJob): void {
    void this.journal.put(job.id, { ...job });
    this.publish();
  }

  private publish(): void {
    this.snapshot = [...this.jobs.values()].sort((left, right) => left.createdAt - right.createdAt).map((job) => ({ ...job }));
    this.listeners.forEach((listener) => listener());
  }
}
