import React, { useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import { cmErrorMessage } from '../../api/cmErrors';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { useCmPolicy } from '../../contexts/useCmPolicy';
import { CmNotice, useCmNotice } from './CmStateViews';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const BYTES_PER_KB = 1024;
const PERCENT_DONE = 100;

/** Account picture upload (`POST /profile/avatar`); the server re-encodes it through the shared avatar pipeline. */
export const CmAvatarCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { bootstrap, refresh } = useCmBootstrap();
  const { maxKycImageKb } = useCmPolicy();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const avatarUrl = bootstrap?.user.avatar_url ?? null;
  const name = bootstrap?.user.name || bootstrap?.user.nickname || bootstrap?.user.username || '';
  const tooLarge = file !== null && file.size > maxKycImageKb * BYTES_PER_KB;
  const wrongType = file !== null && !ACCEPTED_TYPES.includes(file.type);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async (): Promise<void> => {
    if (!file || tooLarge || wrongType || progress !== null) return;
    notice.clear();
    setProgress(0);
    const response = await cmApi.uploadAvatar(file, setProgress);
    setProgress(null);
    if (response.success) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      notice.success(t('settings.avatar.updated'));
      await refresh();
    } else {
      notice.error(cmErrorMessage(t, response, 'settings.avatar.failed'));
    }
  };

  const shown = preview ?? avatarUrl;

  return (
    <section className="cm-section-card">
      <h2><ImageUp aria-hidden="true" /> {t('settings.avatar.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.avatar.lead', { size: Math.round(maxKycImageKb / BYTES_PER_KB) })}</p>
      <div className="cm-avatar-editor">
        {shown ? <img className="cm-avatar-editor__image" src={shown} alt={t('settings.avatar.alt')} /> : <span className="cm-avatar-editor__image cm-avatar-editor__fallback" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
        <div className="cm-settings-form">
          <label className="cm-stacked-field">
            <span>{t('settings.avatar.choose')}</span>
            <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {wrongType && <small className="cm-field-error">{t('settings.avatar.wrongType')}</small>}
          {tooLarge && <small className="cm-field-error">{t('settings.avatar.tooLarge', { size: Math.round(maxKycImageKb / BYTES_PER_KB) })}</small>}
          {progress !== null && <progress max={PERCENT_DONE} value={progress} aria-label={t('settings.avatar.uploading')} />}
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={!file || tooLarge || wrongType || progress !== null} onClick={() => void upload()}>
              {progress !== null ? t('settings.avatar.uploading') : t('settings.avatar.upload')}
            </button>
          </div>
        </div>
      </div>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

export default CmAvatarCard;
