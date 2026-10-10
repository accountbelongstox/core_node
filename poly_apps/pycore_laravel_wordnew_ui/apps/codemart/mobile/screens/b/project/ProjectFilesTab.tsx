import React, { useState } from 'react';
import { Download, Paperclip, Upload } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { cmFormatNumber, useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmProjectAttachments } from '../../../../shared/useCmProjectAttachments';
import { MobileButton, MobileCard, MobileList, MobileListRow, MobileListState, MobilePager, useMobileFeedback, MobileFilePicker } from '../../../ui';

const BYTES_PER_KB = 1024;

/** Project attachments: list with download, and (for managers) a policy-checked upload with progress. */
export const ProjectFilesTab: React.FC<{ projectId: number; canUpload: boolean }> = ({ projectId, canUpload }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const { list, progress, downloadingId, allowedDocumentTypes, maxAttachmentKb, upload, download } = useCmProjectAttachments(projectId, feedback);
  const [files, setFiles] = useState<File[]>([]);

  const send = async (): Promise<void> => {
    const [file] = files;
    if (file && await upload(file)) setFiles([]);
  };

  return (
    <>
      <p className="cmm-hint">{canUpload ? t('attachments.leadManage') : t('attachments.leadRead')}</p>
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={t('attachments.empty')}
        onRetry={list.retryable ? () => void list.reload() : undefined}
        skeletonRows={2}
      >
        <MobileList label={t('attachments.title')}>
          {list.items.map((attachment) => (
            <MobileListRow
              key={attachment.id}
              leading={<Paperclip aria-hidden="true" />}
              title={attachment.original_name ?? attachment.file_name}
              subtitle={[
                attachment.size !== null ? t('attachments.sizeKb', { size: cmFormatNumber(Math.max(1, Math.round(attachment.size / BYTES_PER_KB)), format.language) }) : t('common.unavailable'),
                format.dateTime(attachment.created_at),
              ].join(' · ')}
              trailing={(
                <button type="button" className="cmm-icon-btn" disabled={downloadingId === attachment.id} aria-label={t('common.download')} onClick={() => void download(attachment)}>
                  <Download aria-hidden="true" />
                </button>
              )}
            />
          ))}
        </MobileList>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
      </MobileListState>
      {canUpload && (
        <MobileCard>
          <h3 className="cmm-card-title"><Upload aria-hidden="true" /> {t('attachments.choose')}</h3>
          <div className="cmm-stack-tight">
            <MobileFilePicker label={t('attachments.choose')} files={files} onChange={setFiles} allowedTypes={allowedDocumentTypes} disabled={progress !== null} />
            <p className="cmm-hint">{t('mobile.work.create.filesHint', { types: allowedDocumentTypes.join(', '), size: Math.round(maxAttachmentKb / BYTES_PER_KB) })}</p>
            {progress !== null && <div className="cmm-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}
            <MobileButton variant="primary" block icon={<Upload aria-hidden="true" />} loading={progress !== null} disabled={files.length === 0} onClick={() => void send()}>
              {progress !== null ? t('attachments.uploading', { progress }) : t('attachments.upload')}
            </MobileButton>
          </div>
        </MobileCard>
      )}
    </>
  );
};
