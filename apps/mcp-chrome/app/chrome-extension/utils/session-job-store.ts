const DEFAULT_JOB_LIMIT = 20;

interface SessionJob {
  jobId: string;
}

export interface SessionJobStoreOptions<TJob extends SessionJob> {
  limit?: number;
  serialize?: (job: TJob) => unknown;
  deserialize?: (stored: Record<string, unknown>) => TJob;
}

export class SessionJobStore<TJob extends SessionJob> {
  private readonly jobs = new Map<string, TJob>();
  private readonly limit: number;

  constructor(
    private readonly storageKey: string,
    private readonly options: SessionJobStoreOptions<TJob> = {},
  ) {
    this.limit = options.limit ?? DEFAULT_JOB_LIMIT;
  }

  get(jobId: string): TJob | undefined {
    return this.jobs.get(jobId);
  }

  set(job: TJob): void {
    this.jobs.set(job.jobId, job);
  }

  async persist(): Promise<void> {
    const storedJobs = Array.from(this.jobs.values())
      .slice(-this.limit)
      .map((job) => this.options.serialize?.(job) ?? job);

    try {
      await chrome.storage.session.set({ [this.storageKey]: storedJobs });
    } catch {
      // Session storage is optional; the in-memory index remains available.
    }
  }

  async hydrate(jobId: string): Promise<TJob | undefined> {
    try {
      const storedJobs = (await chrome.storage.session.get(this.storageKey))[this.storageKey];
      if (!Array.isArray(storedJobs)) return undefined;

      const stored = storedJobs.find(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && item['jobId'] === jobId,
      );
      if (!stored) return undefined;

      const job = this.options.deserialize
        ? this.options.deserialize(stored)
        : (stored as unknown as TJob);
      this.jobs.set(jobId, job);
      return job;
    } catch {
      return undefined;
    }
  }
}
