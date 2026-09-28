import React, { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmSubmissionFile } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { CmNotice, useCmNotice } from './CmStateViews';

const LINK_STORAGE = 'link';

export const CmSubmissionFiles: React.FC<{ submissionId: number; files: CmSubmissionFile[] | null | undefined }> = ({ submissionId, files }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [downloading, setDownloading] = useState<number | null>(null);
  const list = Array.isArray(files) ? files : [];

  if (list.length === 0) return <p className="cm-field-hint">{t('submissions.noFiles')}</p>;

  const download = async (file: CmSubmissionFile): Promise<void> => {
    setDownloading(file.index);
    notice.clear();
    const response = await cmApi.downloadSubmissionFile(submissionId, file.index, file.name ?? t('submissions.fileFallback', { index: file.index + 1 }));
    if (!response.success) notice.error(cmErrorMessage(t, response, 'submissions.downloadFailed'));
    setDownloading(null);
  };

  return (
    <div className="cm-file-list">
      <ul>
        {list.map((file) => (
          <li key={file.index}>
            {file.url && (file.storage === LINK_STORAGE || !file.storage) ? (
              <a className="cm-workspace-link" href={file.url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" /> <span>{file.name || file.url}</span>
              </a>
            ) : (
              <button type="button" className="cm-workspace-button is-small" disabled={downloading === file.index} onClick={() => void download(file)}>
                <Download aria-hidden="true" /> {file.name ?? t('submissions.fileFallback', { index: file.index + 1 })}
              </button>
            )}
          </li>
        ))}
      </ul>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </div>
  );
};

export default CmSubmissionFiles;
