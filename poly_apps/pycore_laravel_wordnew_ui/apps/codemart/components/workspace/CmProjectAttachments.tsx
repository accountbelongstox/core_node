import React, { useState } from 'react';
import { Download, Paperclip, Upload } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmProjectAttachments } from '../../shared/useCmProjectAttachments';
import { CmPager } from './CmPager';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { cmFileAccept, cmFormatNumber, useCmFormat } from './cmWorkspaceFormat';

const BYTES_PER_KB = 1024;

export const CmProjectAttachments: React.FC<{ projectId: number; canUpload: boolean }> = ({ projectId, canUpload }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const { list, progress, downloadingId, allowedDocumentTypes, upload: uploadFile, download } = useCmProjectAttachments(projectId, notice);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const upload = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file) return;
    if (await uploadFile(file)) {
      setFile(null);
      setInputKey((key) => key + 1);
    }
  };

  return (
    <section className="cm-section-card">
      <h2><Paperclip aria-hidden="true" /> {t('attachments.title')}</h2>
      <p className="cm-section-card__lead">{canUpload ? t('attachments.leadManage') : t('attachments.leadRead')}</p>
      {list.loading ? (
        <CmLoadingState compact />
      ) : list.error ? (
        <CmErrorState compact message={list.error} onRetry={() => void list.reload()} />
      ) : list.items.length === 0 ? (
        <p className="cm-field-hint">{t('attachments.empty')}</p>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>{t('attachments.name')}</th>
                <th className="is-num">{t('attachments.size')}</th>
                <th>{t('attachments.uploadedAt')}</th>
                <th><span className="cm-visually-hidden">{t('wallet.columnActions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((attachment) => (
                <tr key={attachment.id}>
                  <td className="cm-table__wrap">{attachment.original_name ?? attachment.file_name}</td>
                  <td className="is-num">{attachment.size !== null ? t('attachments.sizeKb', { size: cmFormatNumber(Math.max(1, Math.round(attachment.size / BYTES_PER_KB)), format.language) }) : t('common.unavailable')}</td>
                  <td>{format.dateTime(attachment.created_at)}</td>
                  <td>
                    <button type="button" className="cm-workspace-button is-small" disabled={downloadingId === attachment.id} onClick={() => void download(attachment)}>
                      <Download aria-hidden="true" /> {t('common.download')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {canUpload && (
        <form className="cm-upload-row" onSubmit={(event) => void upload(event)}>
          <label>
            <span>{t('attachments.choose')}</span>
            <input key={inputKey} type="file" accept={cmFileAccept(allowedDocumentTypes)} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" className="cm-workspace-button is-primary" disabled={!file || progress !== null}>
            <Upload aria-hidden="true" /> {progress !== null ? t('attachments.uploading', { progress }) : t('attachments.upload')}
          </button>
        </form>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmProjectAttachments;
