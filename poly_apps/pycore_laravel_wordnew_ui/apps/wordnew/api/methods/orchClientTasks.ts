import type {
  WfNewBookPlanAssignments,
  WfNewBookPlanReadyPage,
  WfNewBookPlanWindow,
  WfNewBookPlanRequest,
  WfNewBookPlanStatus,
  WfNewOrchClientPlaybackPage,
  WfNewOrchClientPlaybackRow,
  WfNewOrchPlaybackHistoryEntry,
  WfNewOrchPlaybackPosition,
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
    progress: objectOrNull(raw?.progress),
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
    progress: row.progress,
    plan_hash: row.planHash,
    status: row.status,
    segment_count: row.segmentCount,
    item_count: row.itemCount,
    duration_ms: row.durationMs,
    device_id: row.deviceId,
    client_updated_at: row.clientUpdatedAt,
  };
}

function text2(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

export function toBookPlanAssignments(raw: any): WfNewBookPlanAssignments {
  return {
    fresh: raw?.fresh === true,
    expiresIn: count(raw?.expires_in),
    windows: (Array.isArray(raw?.windows) ? raw.windows : []).map((window: any) => ({
      sid: text(window?.sid),
      lane: text(window?.lane),
      assigned: count(window?.assigned),
      generating: count(window?.generating),
      done: count(window?.done),
    })),
  };
}

export function toBookPlanStatus(raw: any): WfNewBookPlanStatus {
  return {
    planId: text(raw?.plan_id),
    state: raw?.state === 'building' ? 'building' : 'ready',
    total: count(raw?.total),
    ready: count(raw?.ready),
    generating: count(raw?.generating),
    queued: count(raw?.queued),
    failed: count(raw?.failed),
    emptyLanguages: (Array.isArray(raw?.empty_languages) ? raw.empty_languages : []).filter((lang: unknown): lang is string => typeof lang === 'string' && lang !== ''),
    readyCursor: count(raw?.ready_cursor),
    nodes: (Array.isArray(raw?.nodes) ? raw.nodes : []).map((node: any) => ({
      sid: text(node?.sid),
      label: text2(node?.label, text(node?.sid)),
      platform: text(node?.platform),
      computeClass: text(node?.compute_class),
      count: count(node?.count),
    })),
    fastPass: raw?.fast_pass === true,
    upgrade: { total: count(raw?.upgrade?.total), done: count(raw?.upgrade?.done) },
    assignments: toBookPlanAssignments(raw?.assignments),
    updatedAt: text(raw?.updated_at),
  };
}

function toPlaybackPosition(raw: any): WfNewOrchPlaybackPosition | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    segment: count(raw.segment),
    time: count(raw.time),
    anchor: text(raw.anchor),
    offset: count(raw.offset),
    label: text(raw.label),
    editionId: text(raw.edition_id),
    at: text(raw.at),
  };
}

function fromPlaybackPosition(position: WfNewOrchPlaybackPosition): Record<string, unknown> {
  return {
    segment: position.segment,
    time: position.time,
    anchor: position.anchor,
    offset: position.offset,
    label: position.label,
    edition_id: position.editionId,
    at: position.at,
  };
}

export function toOrchClientPlaybackRow(raw: any): WfNewOrchClientPlaybackRow {
  const history = (Array.isArray(raw?.history) ? raw.history : [])
    .map((entry: any): WfNewOrchPlaybackHistoryEntry | null => {
      const position = toPlaybackPosition(entry);
      return position && text(entry?.id) ? { ...position, id: text(entry.id) } : null;
    })
    .filter((entry: WfNewOrchPlaybackHistoryEntry | null): entry is WfNewOrchPlaybackHistoryEntry => entry !== null);
  return {
    clientTaskId: text(raw?.client_task_id),
    resume: toPlaybackPosition(raw?.resume),
    history,
    clientUpdatedAt: text(raw?.client_updated_at),
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

  async postBookAudioPlan(request: WfNewBookPlanRequest): Promise<WfNewBookPlanStatus> {
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.orchBookPlans, {
      source_key: request.sourceKey,
      chapter_index: request.chapterIndex,
      languages: request.languages,
      include_words: request.includeWords,
      position: request.position,
      plan_hash: request.planHash,
    }));
    return toBookPlanStatus(res?.plan ?? res);
  },

  async postBookAudioPlanAssignments(planId: string, from: number, windows: WfNewBookPlanWindow[]): Promise<WfNewBookPlanAssignments> {
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.orchBookPlanAssignments(planId), { from, windows }));
    return toBookPlanAssignments(res?.assignments ?? res);
  },

  async getBookAudioPlan(planId: string): Promise<WfNewBookPlanStatus> {
    const res = await authedGetFreshJSON<any>(WfNewApiPaths.orchBookPlan(planId), null);
    return toBookPlanStatus(res?.plan ?? res);
  },

  async getBookAudioPlanReady(planId: string, cursor: number, limit: number): Promise<WfNewBookPlanReadyPage> {
    const res = await authedGetFreshJSON<any>(WfNewApiPaths.orchBookPlanReady(planId, cursor, limit), null);
    return { ids: (Array.isArray(res?.ids) ? res.ids : []).filter((id: unknown): id is string => typeof id === 'string'), cursor: count(res?.cursor), more: res?.more === true };
  },

  async getOrchClientPlayback(page = 1, since: string | null = null): Promise<WfNewOrchClientPlaybackPage> {
    const res = await authedGetFreshJSON<any>(WfNewApiPaths.orchClientPlaybackList(page, ORCH_CLIENT_TASK_PAGE_SIZE, since), null);
    const items = (Array.isArray(res?.items) ? res.items : []).map(toOrchClientPlaybackRow);
    return {
      items,
      total: count(res?.total ?? items.length),
      page: count(res?.page ?? page),
      perPage: count(res?.per_page ?? ORCH_CLIENT_TASK_PAGE_SIZE),
      serverTime: text(res?.server_time) || null,
    };
  },

  async saveOrchClientPlayback(row: WfNewOrchClientPlaybackRow): Promise<{ row: WfNewOrchClientPlaybackRow; applied: boolean }> {
    const res = unwrapEnvelope(await authedPostJSON<any>(WfNewApiPaths.orchClientPlayback(row.clientTaskId), {
      resume: row.resume ? fromPlaybackPosition(row.resume) : null,
      history: row.history.map((entry) => ({ ...fromPlaybackPosition(entry), id: entry.id })),
      client_updated_at: row.clientUpdatedAt,
    }));
    const stored = res?.playback ?? res;
    return { row: stored?.client_task_id ? toOrchClientPlaybackRow(stored) : row, applied: res?.applied !== false };
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

  async postBookAudioPlan(request: WfNewBookPlanRequest): Promise<WfNewBookPlanStatus> {
    return toBookPlanStatus({ plan_id: request.planHash, total: 0 });
  },

  async postBookAudioPlanAssignments(): Promise<WfNewBookPlanAssignments> {
    return toBookPlanAssignments({});
  },

  async getBookAudioPlan(planId: string): Promise<WfNewBookPlanStatus> {
    return toBookPlanStatus({ plan_id: planId });
  },

  async getBookAudioPlanReady(_planId: string, cursor: number): Promise<WfNewBookPlanReadyPage> {
    return { ids: [], cursor, more: false };
  },

  async getOrchClientPlayback(page = 1): Promise<WfNewOrchClientPlaybackPage> {
    return { items: [], total: 0, page, perPage: ORCH_CLIENT_TASK_PAGE_SIZE, serverTime: null };
  },

  async saveOrchClientPlayback(row: WfNewOrchClientPlaybackRow): Promise<{ row: WfNewOrchClientPlaybackRow; applied: boolean }> {
    return { row, applied: true };
  },
};
