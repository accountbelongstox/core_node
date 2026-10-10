import React from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmSubmissionFile } from '../../../../api/CmApiTypes';
import { cmSubmissionFileIsLink, useCmSubmissionFileDownload } from '../../../../shared/useCmSubmissionFiles';
import { MobileButton, useMobileFeedback } from '../../../ui';

/** Files delivered with a submission: links open in the browser, stored uploads download through the API. */
export const MobileSubmissionFiles: React.FC<{ submissionId: number; files: CmSubmissionFile[] | null | undefined }> = ({ submissionId, files }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { downloadingIndex, fileLabel, download } = useCmSubmissionFileDownload(submissionId, feedback);
  const list = Array.isArray(files) ? files : [];

  if (list.length === 0) return <p className="cmm-hint">{t('submissions.noFiles')}</p>;

  return (
    <ul className="cmm-filelist">
      {list.map((file) => (
        <li key={file.index}>
          <span>{fileLabel(file)}</span>
          {cmSubmissionFileIsLink(file) ? (
            <a className="cmm-btn is-small" href={file.url ?? undefined} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /><span>{t('mobile.work.openLink')}</span></a>
          ) : (
            <MobileButton small icon={<Download aria-hidden="true" />} loading={downloadingIndex === file.index} onClick={() => void download(file)}>{t('common.download')}</MobileButton>
          )}
        </li>
      ))}
    </ul>
  );
};
