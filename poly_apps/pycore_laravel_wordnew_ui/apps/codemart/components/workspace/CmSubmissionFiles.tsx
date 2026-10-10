import React from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmSubmissionFile } from '../../api/CmApiTypes';
import { cmSubmissionFileIsLink, useCmSubmissionFileDownload } from '../../shared/useCmSubmissionFiles';
import { CmNotice, useCmNotice } from './CmStateViews';

export const CmSubmissionFiles: React.FC<{ submissionId: number; files: CmSubmissionFile[] | null | undefined }> = ({ submissionId, files }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { downloadingIndex, fileLabel, download } = useCmSubmissionFileDownload(submissionId, notice);
  const list = Array.isArray(files) ? files : [];

  if (list.length === 0) return <p className="cm-field-hint">{t('submissions.noFiles')}</p>;

  return (
    <div className="cm-file-list">
      <ul>
        {list.map((file) => (
          <li key={file.index}>
            {cmSubmissionFileIsLink(file) ? (
              <a className="cm-workspace-link" href={file.url ?? undefined} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" /> <span>{file.name || file.url}</span>
              </a>
            ) : (
              <button type="button" className="cm-workspace-button is-small" disabled={downloadingIndex === file.index} onClick={() => void download(file)}>
                <Download aria-hidden="true" /> {fileLabel(file)}
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
