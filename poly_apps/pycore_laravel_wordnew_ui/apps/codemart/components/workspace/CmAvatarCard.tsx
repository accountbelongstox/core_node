import React, { useRef } from 'react';
import { ImageUp } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmAvatarUpload } from '../../shared/useCmProfile';
import { CmNotice, useCmNotice } from './CmStateViews';

const PERCENT_DONE = 100;

/** Account picture upload (`POST /profile/avatar`); the server re-encodes it through the shared avatar pipeline. */
export const CmAvatarCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const avatar = useCmAvatarUpload(notice);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { progress, shown } = avatar;

  const upload = async (): Promise<void> => {
    await avatar.upload();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="cm-section-card">
      <h2><ImageUp aria-hidden="true" /> {t('settings.avatar.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.avatar.lead', { size: avatar.maxSizeMb })}</p>
      <div className="cm-avatar-editor">
        {shown ? <img className="cm-avatar-editor__image" src={shown} alt={t('settings.avatar.alt')} /> : <span className="cm-avatar-editor__image cm-avatar-editor__fallback" aria-hidden="true">{avatar.initial}</span>}
        <div className="cm-settings-form">
          <label className="cm-stacked-field">
            <span>{t('settings.avatar.choose')}</span>
            <input ref={inputRef} type="file" accept={avatar.acceptedTypes.join(',')} onChange={(event) => avatar.setFile(event.target.files?.[0] ?? null)} />
          </label>
          {avatar.wrongType && <small className="cm-field-error">{t('settings.avatar.wrongType')}</small>}
          {avatar.tooLarge && <small className="cm-field-error">{t('settings.avatar.tooLarge', { size: avatar.maxSizeMb })}</small>}
          {progress !== null && <progress max={PERCENT_DONE} value={progress} aria-label={t('settings.avatar.uploading')} />}
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={!avatar.canUpload} onClick={() => void upload()}>
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
