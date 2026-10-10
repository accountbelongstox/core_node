import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmSubmissionFile } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import type { CmFeedback } from './cmFeedback';

const LINK_STORAGE = 'link';

/** A delivered file that is an external link (opened in a new tab) rather than a stored upload (downloaded through the API). */
export const cmSubmissionFileIsLink = (file: CmSubmissionFile): boolean => Boolean(file.url && (file.storage === LINK_STORAGE || !file.storage));

export interface CmSubmissionFileDownloadModel {
  downloadingIndex: number | null;
  fileLabel: (file: CmSubmissionFile) => string;
  download: (file: CmSubmissionFile) => Promise<void>;
}

/** Authenticated download of the files delivered with a submission. */
export function useCmSubmissionFileDownload(submissionId: number, feedback: CmFeedback): CmSubmissionFileDownloadModel {
  const { t } = useTranslation('cm');
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const fileLabel = useCallback((file: CmSubmissionFile): string => file.name ?? t('submissions.fileFallback', { index: file.index + 1 }), [t]);

  const download = useCallback(async (file: CmSubmissionFile): Promise<void> => {
    setDownloadingIndex(file.index);
    feedback.clear();
    const response = await cmApi.downloadSubmissionFile(submissionId, file.index, fileLabel(file));
    if (!response.success) feedback.error(cmErrorMessage(t, response, 'submissions.downloadFailed'));
    setDownloadingIndex(null);
  }, [submissionId, feedback, fileLabel, t]);

  return { downloadingIndex, fileLabel, download };
}
