import type {
  WordNewGroupProgressBlob,
  WordNewGroupProgressPayload,
  WordNewRecitationLogPayload,
  WordNewRecitationLogResult,
  WordNewRecitationStreak,
  WordNewRecitationSummary,
  WordNewRecitationTodayPlan,
} from '../WfNewApiTypes';
import { WfNewApiPaths } from '../WfNewApiPaths';
import {
  authToken,
  authedGetJSON,
  queryPostJSON,
  queueablePostJSON,
  unwrapEnvelope,
} from '../WfNewApiTransport';
import { WORDNEW_PROGRESS_LEGEND } from '../WfNewApiTypes';
import { removeMirroredResponse, requestVariant } from '../../cache/WfNewServerMirror';

export function invalidateGroupProgressCache(
  gid: string,
  token: string | null = authToken,
): Promise<boolean> {
  return removeMirroredResponse(
    WfNewApiPaths.groupProgressBlob,
    token,
    requestVariant('POST', { gid }),
  );
}

export const learningMethods = {
  async getGroupProgressBlob(gid: string): Promise<WordNewGroupProgressBlob> {
    const response = await queryPostJSON<any>(WfNewApiPaths.groupProgressBlob, { gid });
    const data = unwrapEnvelope(response) ?? response;
    return {
      gid: String(data?.gid ?? gid),
      gname: String(data?.gname ?? ''),
      language_code: data?.language_code ?? null,
      total_words: Number(data?.total_words ?? 0),
      legend: data?.legend && typeof data.legend === 'object'
        ? data.legend
        : WORDNEW_PROGRESS_LEGEND,
      words: data?.words && typeof data.words === 'object' ? data.words : {},
    };
  },

  async updateGroupProgress(payload: WordNewGroupProgressPayload): Promise<any> {
    const requestToken = authToken;
    const response = await queueablePostJSON<any>(WfNewApiPaths.groupUpdateProgress, payload);
    if (payload.gid) {
      await invalidateGroupProgressCache(payload.gid, requestToken);
    }
    return unwrapEnvelope(response) ?? response;
  },

  async recitationLog(payload: WordNewRecitationLogPayload): Promise<WordNewRecitationLogResult> {
    const requestToken = authToken;
    const response = await queueablePostJSON<any>(WfNewApiPaths.recitationLog, payload);
    const result = (unwrapEnvelope(response) ?? response) as WordNewRecitationLogResult;
    await Promise.all([
      removeMirroredResponse(WfNewApiPaths.recitationTodayPlan(), requestToken),
      removeMirroredResponse(WfNewApiPaths.recitationSummary(result.date), requestToken),
      removeMirroredResponse(WfNewApiPaths.recitationStreak, requestToken),
    ]);
    return result;
  },

  async recitationTodayPlan(
    params: { language?: string; limit?: number } = {},
  ): Promise<WordNewRecitationTodayPlan> {
    return authedGetJSON<WordNewRecitationTodayPlan>(
      WfNewApiPaths.recitationTodayPlan(params),
      { date: '', goal: 0, done_today: 0, words: [] },
    );
  },

  async recitationSummary(date?: string): Promise<WordNewRecitationSummary> {
    const path = WfNewApiPaths.recitationSummary(date);
    return authedGetJSON<WordNewRecitationSummary>(path, {
      date: date ?? '', unique_words: 0, actions: 0, goal: 0, goal_met: false, words: [],
    });
  },

  async recitationStreak(): Promise<WordNewRecitationStreak> {
    const path = WfNewApiPaths.recitationStreak;
    return authedGetJSON<WordNewRecitationStreak>(path, {
      current_streak: 0, longest_streak: 0, days: [],
    });
  },
};
