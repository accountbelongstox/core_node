import type { WfNewReaderSettingsBlob } from '../WfNewApiTypes';
import { WfNewApiPaths } from '../WfNewApiPaths';
import {
  authToken,
  authedGetJSON,
  authedPostJSON,
  getJSON,
  postJSON,
  unwrapEnvelope,
} from '../WfNewApiTransport';

export const readingMethods = {
  async getBookReadingProgress(sourceKey: string) {
    if (!authToken) return null;
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userBookProgress(sourceKey), null);
      const progress = res?.progress;
      if (!progress) return null;
      return {
        sourceKey: progress.source_key ?? sourceKey,
        chapterIndex: progress.chapter_index ?? null,
        verseSeq: Number(progress.verse_seq ?? 0),
        grain: progress.grain ?? 'sentence',
        page: Number(progress.page ?? 1),
        updatedAt: progress.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async saveBookReadingProgress(
    sourceKey: string,
    payload: { chapterIndex?: number | null; verseSeq: number; grain?: string; page?: number },
  ) {
    if (!authToken) return null;
    try {
      const raw = await postJSON<any>(WfNewApiPaths.userBookProgress(sourceKey), {
        chapter_index: payload.chapterIndex ?? null,
        verse_seq: payload.verseSeq,
        grain: payload.grain ?? 'sentence',
        page: payload.page ?? 1,
      });
      const progress = unwrapEnvelope(raw)?.progress;
      if (!progress) return null;
      return {
        sourceKey: progress.source_key ?? sourceKey,
        chapterIndex: progress.chapter_index ?? null,
        verseSeq: Number(progress.verse_seq ?? 0),
        grain: progress.grain ?? 'sentence',
        page: Number(progress.page ?? 1),
        updatedAt: progress.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async listBookReadingProgress(limit = 100) {
    if (!authToken) return [];
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userBookProgressList(limit), { items: [] });
      const items = Array.isArray(res?.items) ? res.items : [];
      return items.map((progress: any) => ({
        sourceKey: progress.source_key ?? '',
        chapterIndex: progress.chapter_index ?? null,
        verseSeq: Number(progress.verse_seq ?? 0),
        grain: progress.grain ?? 'sentence',
        page: Number(progress.page ?? 1),
        updatedAt: progress.updated_at ?? null,
      }));
    } catch {
      return [];
    }
  },

  async getDailyReadingProgress() {
    if (!authToken) return null;
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userDailyReadingProgress, null);
      const progress = res?.progress;
      if (!progress) return null;
      return {
        articleId: progress.article_id ? String(progress.article_id) : null,
        selectionMode: ['latest', 'resume', 'random'].includes(progress.selection_mode)
          ? progress.selection_mode
          : 'latest',
        updatedAt: progress.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async saveDailyReadingProgress(articleId: string | null, selectionMode?: 'latest' | 'resume' | 'random') {
    if (!authToken) return null;
    try {
      const raw = await postJSON<any>(WfNewApiPaths.userDailyReadingProgress, {
        ...(articleId ? { article_id: articleId } : {}),
        ...(selectionMode ? { selection_mode: selectionMode } : {}),
      });
      const progress = unwrapEnvelope(raw)?.progress;
      if (!progress) return null;
      return {
        articleId: progress.article_id ? String(progress.article_id) : null,
        selectionMode: ['latest', 'resume', 'random'].includes(progress.selection_mode)
          ? progress.selection_mode
          : 'latest',
        updatedAt: progress.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async previewDailyReadingResources(
    articleId: string,
    settings: Parameters<import('../WfNewApiTypes').WfNewApi['previewDailyReadingResources']>[1],
    groupId: string | null = null,
    batchName?: string,
  ) {
    const raw = await authedPostJSON<any>(
      WfNewApiPaths.userDailyReadingResourcePreview(articleId),
      {
        settings,
        ...(groupId ? { group_id: groupId } : {}),
        ...(batchName?.trim() ? { batch_name: batchName.trim() } : {}),
      },
    );
    const payload = unwrapEnvelope(raw);
    return {
      resource: payload.resource,
      apiUrl: payload.api_url,
      expiresAt: payload.expires_at,
      batchName: payload.batch_name,
    };
  },

  async getClientDeviceSettings(clientKey: string) {
    try {
      const res = await getJSON<any>(WfNewApiPaths.clientDeviceSettings(clientKey));
      const settings = res?.settings;
      if (!settings) return null;
      return {
        clientKey: settings.client_key ?? clientKey,
        reader: settings.reader ?? null,
        updatedAt: settings.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async saveClientDeviceSettings(
    clientKey: string,
    reader: WfNewReaderSettingsBlob,
    updatedAt?: string,
  ) {
    try {
      const raw = await postJSON<any>(WfNewApiPaths.clientDeviceSettingsSave, {
        client_key: clientKey,
        reader,
        updated_at: updatedAt ?? new Date().toISOString(),
      });
      const settings = unwrapEnvelope(raw)?.settings ?? raw?.settings;
      if (!settings) return null;
      return {
        clientKey: settings.client_key ?? clientKey,
        reader: settings.reader ?? reader,
        updatedAt: settings.updated_at ?? updatedAt ?? null,
      };
    } catch {
      return null;
    }
  },
};
