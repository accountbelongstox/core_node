import React, { useEffect, useRef, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { MobileButton } from './MobileButton';

interface MobileImagePickerProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | false | null;
  hint?: string;
  /** Camera used by the capture button: the rear camera for documents, the front one for selfies. */
  camera?: 'environment' | 'user';
  accept?: string;
}

/** Image slot filled from the camera or the gallery, with a preview of the chosen picture. */
export const MobileImagePicker: React.FC<MobileImagePickerProps> = ({ label, file, onChange, error, hint, camera = 'environment', accept = 'image/*' }) => {
  const { t } = useTranslation('cm');
  const [preview, setPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  return (
    <div className="cmm-picker" data-invalid={Boolean(error) || undefined}>
      <span className="cmm-field__label">{label}</span>
      <div className="cmm-picker__body">
        <span className="cmm-picker__preview">{preview ? <img src={preview} alt={label} /> : <Images aria-hidden="true" />}</span>
        <div className="cmm-picker__actions">
          <MobileButton small icon={<Camera aria-hidden="true" />} onClick={() => cameraRef.current?.click()}>{t('mobile.ui.takePhoto')}</MobileButton>
          <MobileButton small variant="ghost" icon={<Images aria-hidden="true" />} onClick={() => galleryRef.current?.click()}>{t('mobile.ui.chooseFile')}</MobileButton>
          {file && <small className="cmm-field__hint">{file.name}</small>}
        </div>
      </div>
      {error ? <small className="cmm-field__error" role="alert">{error}</small> : hint ? <small className="cmm-field__hint">{hint}</small> : null}
      <input ref={cameraRef} type="file" accept={accept} capture={camera} hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept={accept} hidden onChange={pick} />
    </div>
  );
};
