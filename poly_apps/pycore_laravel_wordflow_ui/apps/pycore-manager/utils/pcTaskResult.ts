/**
 * Shared task result merging for Queue Center panels + detail modals.
 * Local TaskManager rows may spread synth fields across input_data and result
 * (processing patches land in result; sentence worker seeds input on create).
 */

type LooseRecord = Record<string, unknown> | null | undefined;

/** Shallow merge: result wins over input for overlapping keys. */
export function mergeTaskResultSources(input: LooseRecord, result: LooseRecord): Record<string, unknown> {
  const inObj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const resObj = result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  return { ...inObj, ...resObj };
}

/** Laravel global_tasks ids: task_<uuid> (see TaskManagerService.createTask). */
export function isLaravelGlobalTaskId(id: unknown): id is string {
  return typeof id === 'string' && /^task_[0-9a-f-]{36}$/i.test(id);
}

/** Sentence-library queue row id (integer from claim API), not global_tasks. */
export function isSentenceQueueJobId(id: unknown): boolean {
  if (typeof id === 'number' && Number.isFinite(id)) return true;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

export function resolveRemoteTaskId(input: LooseRecord, result: LooseRecord): unknown {
  return mergeTaskResultSources(input, result).remote_task_id;
}

export function resolveTaskWorker(input: LooseRecord, result: LooseRecord): string | null {
  const w = mergeTaskResultSources(input, result)._worker;
  return typeof w === 'string' && w.trim() ? w.trim() : null;
}
