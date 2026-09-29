import React, { useCallback, useState } from 'react';
import { Download, Paperclip, Upload } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmAttachment, CmListPage } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { CmPager } from './CmPager';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { cmFormatNumber, cmTotalPages, useCmFormat } from './cmWorkspaceFormat';
import { useCmPagedList } from './useCmPagedList';

const BYTES_PER_KB = 1024;

const extractAttachments = (data: CmListPage<CmAttachment>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

export const CmProjectAttachments: React.FC<{ projectId: number; canUpload: boolean }> = ({ projectId, canUpload }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const fetcher = useCallback((page: number) => cmApi.getProjectAttachments(projectId, page), [projectId]);
  const list = useCmPagedList(fetcher, extractAttachments, 'attachments.loadFailed');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const upload = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file || progress !== null) return;
    notice.clear();
    setProgress(0);
    const response = await cmApi.uploadProjectAttachment(projectId, file, setProgress);
    setProgress(null);
    if (response.success) {
      notice.success(t('attachments.uploaded'));
      setFile(null);
      setInputKey((key) => key + 1);
      await list.load(1);
    } else {
      notice.error(cmErrorMessage(t, response, 'attachments.uploadFailed'));
    }
  };

  const download = async (attachment: CmAttachment): Promise<void> => {
    notice.clear();
    setDownloadingId(attachment.id);
    const response = await cmApi.downloadProjectAttachment(projectId, attachment);
    setDownloadingId(null);
    if (!response.success) notice.error(cmErrorMessage(t, response, 'attachments.downloadFailed'));
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
            <input key={inputKey} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
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
