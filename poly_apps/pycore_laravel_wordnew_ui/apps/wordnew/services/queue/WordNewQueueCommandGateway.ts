class WordNewQueueCommandCapacityError extends Error {
  constructor(limit: number) {
    super(`Queue command mapping limit reached: ${limit}`);
    this.name = 'WordNewQueueCommandCapacityError';
  }
}

export abstract class WordNewQueueCommandGateway {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly limit: number;

  protected constructor(limit: number) {
    this.limit = Math.max(1, Math.floor(limit));
  }

  protected executeBatchOnce<Value, Result>(
    namespace: string,
    values: Value[],
    keyOf: (value: Value) => string,
    command: (freshValues: Value[]) => Promise<Result>,
  ): Promise<Result | null> {
    const blockers: Promise<unknown>[] = [];
    const freshValues: Value[] = [];
    const freshKeys: string[] = [];
    const seenKeys = new Set<string>();
    let pending: Promise<Result>;
    for (const value of values) {
      const valueKey = keyOf(value);
      const key = valueKey ? `${namespace}:${valueKey}` : '';
      const current = key ? this.inFlight.get(key) : null;
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      if (current) {
        blockers.push(current);
        continue;
      }
      freshValues.push(value);
      freshKeys.push(key);
    }
    if (freshKeys.length === 0) {
      return Promise.all(Array.from(new Set(blockers))).then(() => null);
    }
    if (freshKeys.length > this.limit - this.inFlight.size) {
      return Promise.reject(new WordNewQueueCommandCapacityError(this.limit));
    }
    pending = Promise.resolve().then(() => command(freshValues)).finally(() => {
      freshKeys.forEach((key) => {
        if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
      });
    });
    freshKeys.forEach((key) => this.inFlight.set(key, pending));
    return Promise.all([...Array.from(new Set(blockers)), pending])
      .then((results) => results[results.length - 1] as Result);
  }

  protected boundedUnique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
      .slice(0, this.limit);
  }

  protected boundedByKey<T>(values: T[], keyOf: (value: T) => string): T[] {
    const result: T[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const key = keyOf(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
      if (result.length >= this.limit) break;
    }
    return result;
  }
}
