import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmAttachment, CmListPage } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmFileTypeAllowed, cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';

const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;

/** First server field message of a validation failure, when present. */
function firstServerFieldMessage(response: unknown): string | null {
  const body = (response as { debugInfo?: Record<string, unknown> })?.debugInfo;
  for (const bag of [body?.data, body?.details]) {
    if (bag && typeof bag === 'object' && !Array.isArray(bag)) {
      for (const messages of Object.values(bag as Record<string, unknown>)) {
        if (Array.isArray(messages) && typeof messages[0] === 'string' && messages[0]) return messages[0];
      }
    }
  }
  return null;
}

const extractAttachments = (data: CmListPage<CmAttachment>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

type CmTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Why a file cannot be attached under the server policy (size, extension), or null when it can. */
export function cmAttachmentIssue(file: File, policy: { maxAttachmentKb: number; allowedDocumentTypes: string[] }, t: CmTranslate): string | null {
  if (file.size > policy.maxAttachmentKb * BYTES_PER_KB) return t('attachments.tooLarge', { size: Math.round(policy.maxAttachmentKb / KB_PER_MB) });
  if (!cmFileTypeAllowed(file.name, policy.allowedDocumentTypes)) return t('attachments.wrongType', { types: policy.allowedDocumentTypes.join(', ') });
  return null;
}

/** First server field message of a failed upload, else the coded error message. */
export function cmAttachmentUploadError(response: Parameters<typeof cmErrorMessage>[1], t: CmTranslate): string {
  return firstServerFieldMessage(response) ?? cmErrorMessage(t, response, 'attachments.uploadFailed');
}

export interface CmProjectAttachmentsModel {
  list: CmPagedList<CmAttachment>;
  /** Upload progress 0..100 while an upload runs, otherwise null. */
  progress: number | null;
  downloadingId: number | null;
  maxAttachmentKb: number;
  allowedDocumentTypes: string[];
  /** Validate against the server policy and upload; true on success. */
  upload: (file: File) => Promise<boolean>;
  download: (attachment: CmAttachment) => Promise<void>;
}

/** Project attachments: paged list, policy-checked upload with progress, authenticated download. */
export function useCmProjectAttachments(projectId: number, feedback: CmFeedback): CmProjectAttachmentsModel {
  const { t } = useTranslation('cm');
  const fetcher = useCallback((page: number) => cmApi.getProjectAttachments(projectId, page), [projectId]);
  const list = useCmPagedList(fetcher, extractAttachments, 'attachments.loadFailed');
  const { maxAttachmentKb, allowedDocumentTypes } = useCmPolicy();
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const { load } = list;

  const upload = useCallback(async (file: File): Promise<boolean> => {
    if (progress !== null) return false;
    feedback.clear();
    const issue = cmAttachmentIssue(file, { maxAttachmentKb, allowedDocumentTypes }, t);
    if (issue) {
      feedback.error(issue);
      return false;
    }
    setProgress(0);
    const response = await cmApi.uploadProjectAttachment(projectId, file, setProgress);
    setProgress(null);
    if (response.success) {
      feedback.success(t('attachments.uploaded'));
      await load(1);
      return true;
    }
    feedback.error(cmAttachmentUploadError(response, t));
    return false;
  }, [progress, feedback, maxAttachmentKb, allowedDocumentTypes, projectId, load, t]);

  const download = useCallback(async (attachment: CmAttachment): Promise<void> => {
    feedback.clear();
    setDownloadingId(attachment.id);
    const response = await cmApi.downloadProjectAttachment(projectId, attachment);
    setDownloadingId(null);
    if (!response.success) feedback.error(cmErrorMessage(t, response, 'attachments.downloadFailed'));
  }, [feedback, projectId, t]);

  return { list, progress, downloadingId, maxAttachmentKb, allowedDocumentTypes, upload, download };
}
