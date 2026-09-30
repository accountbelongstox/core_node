import type {
  WfNewOrchClientTaskPage,
  WfNewOrchClientTaskRow,
  WfNewOrchClientTaskWrite,
} from '../types/orchAudio';
import { WfNewApiPaths } from '../WfNewApiPaths';
import { authedGetFreshJSON, authedPostJSON, deleteJSON, requireAuthToken, unwrapEnvelope } from '../WfNewApiTransport';

export const ORCH_CLIENT_TASK_PAGE_SIZE = 200;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toOrchClientTaskRow(raw: any): WfNewOrchClientTaskRow {
  return {
    clientTaskId: text(raw?.client_task_id),
    name: text(raw?.name),
    source: text(raw?.source),
    language: text(raw?.language),
    sourceRef: objectOrNull(raw?.source_ref),
    config: objectOrNull(raw?.config),
    planHash: text(raw?.plan_hash),
    status: text(raw?.status),
    segmentCount: count(raw?.segment_count),
    itemCount: count(raw?.item_count),
    durationMs: count(raw?.duration_ms),
    deviceId: text(raw?.device_id),
    clientUpdatedAt: text(raw?.client_updated_at),
    deleted: raw?.deleted === true,
  };
}

export function fromOrchClientTaskRow(row: WfNewOrchClientTaskRow): Record<string, unknown> {
  return {
    name: row.name,
    source: row.source,
    language: row.language,
    source_ref: row.sourceRef,
    config: row.config,
    plan_hash: row.planHash,
    status: row.status,
    segment_count: row.segmentCount,
    item_count: row.itemCount,
    duration_ms: row.durationMs,
    device_id: row.deviceId,
    client_updated_at: row.clientUpdatedAt,
  };
}

export const orchClientTaskMethods = {
  async getOrchClientTasks(page = 1, since: string | null = null): Promise<WfNewOrchClientTaskPage> {
    const res = await authedGetFreshJSON<any>(WfNewApiPaths.orchClientTasks(page, ORCH_CLIENT_TASK_PAGE_SIZE, since), null);
    const items = (Array.isArray(res?.items) ? res.items : []).map(toOrchClientTaskRow);
    return {
      items,
      total: count(res?.total ?? items.length),
      page: count(res?.page ?? page),
      perPage: count(res?.per_page ?? ORCH_CLIENT_TASK_PAGE_SIZE),
      serverTime: text(res?.server_time) || null,
    };
  },

  async saveOrchClientTask(row: WfNewOrchClientTaskRow): Promise<WfNewOrchClientTaskWrite> {
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.orchClientTask(row.clientTaskId), fromOrchClientTaskRow(row)));
    const stored = res?.task ?? res;
    return { row: stored?.client_task_id ? toOrchClientTaskRow(stored) : row, applied: res?.applied !== false };
  },

  async deleteOrchClientTask(clientTaskId: string, clientUpdatedAt: string): Promise<void> {
    requireAuthToken();
    await deleteJSON(WfNewApiPaths.orchClientTaskDelete(clientTaskId, clientUpdatedAt));
  },
};

export const mockOrchClientTaskMethods = {
  async getOrchClientTasks(page = 1): Promise<WfNewOrchClientTaskPage> {
    return { items: [], total: 0, page, perPage: ORCH_CLIENT_TASK_PAGE_SIZE, serverTime: null };
  },

  async saveOrchClientTask(row: WfNewOrchClientTaskRow): Promise<WfNewOrchClientTaskWrite> {
    return { row, applied: true };
  },

  async deleteOrchClientTask(_clientTaskId: string, _clientUpdatedAt: string): Promise<void> {},
};
