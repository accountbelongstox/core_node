import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmAvatarUpload } from '../../../../shared/useCmProfile';
import { MobileButton, MobileSheet } from '../../../ui';
import { MobileImagePicker } from '../parts/MobileImagePicker';
import { useInlineFeedback } from '../parts/useInlineFeedback';

interface AvatarSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Account picture: current avatar or the chosen photo preview, uploaded with progress. */
export const AvatarSheet: React.FC<AvatarSheetProps> = ({ open, onClose }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice, clear } = useInlineFeedback();
  const avatar = useCmAvatarUpload(feedback);
  const uploading = avatar.progress !== null;

  const close = (): void => {
    if (uploading) return;
    clear();
    avatar.setFile(null);
    onClose();
  };

  const upload = async (): Promise<void> => {
    if (!(await avatar.upload())) return;
    clear();
    onClose();
  };

  const fileError = (avatar.wrongType && t('settings.avatar.wrongType')) || (avatar.tooLarge && t('settings.avatar.tooLarge', { size: avatar.maxSizeMb })) || null;

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title={t('settings.avatar.title')}
      footer={(
        <MobileButton variant="primary" block loading={uploading} disabled={!avatar.canUpload} onClick={() => void upload()}>
          {uploading ? t('settings.avatar.uploading') : t('settings.avatar.upload')}
        </MobileButton>
      )}
    >
      <div className="cmmc-form">
        <div className="cmmc-avatar-preview">
          {avatar.shown ? <img src={avatar.shown} alt={t('settings.avatar.alt')} /> : <span aria-hidden="true">{avatar.initial}</span>}
        </div>
        <p className="cmm-muted">{t('settings.avatar.lead', { size: avatar.maxSizeMb })}</p>
        <MobileImagePicker
          label={t('settings.avatar.choose')}
          camera="user"
          accept={avatar.acceptedTypes.join(',')}
          file={avatar.file}
          onChange={avatar.setFile}
          error={fileError}
        />
        {uploading && <progress className="cmmc-progress" max={100} value={avatar.progress ?? 0} aria-label={t('settings.avatar.uploading')} />}
        {notice}
      </div>
    </MobileSheet>
  );
};
