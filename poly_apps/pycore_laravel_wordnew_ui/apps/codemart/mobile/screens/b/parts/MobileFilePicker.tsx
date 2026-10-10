import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { cmFileAccept } from '../../../../components/workspace/cmWorkspaceFormat';
import { MobileButton } from '../../../ui';

interface MobileFilePickerProps {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** Allowed extensions from the server policy (empty = any). */
  allowedTypes: string[];
  multiple?: boolean;
  disabled?: boolean;
  error?: string | false | null;
}

/** File chooser with the chosen files listed and removable; the system picker honours the policy extensions. */
export const MobileFilePicker: React.FC<MobileFilePickerProps> = ({ label, files, onChange, allowedTypes, multiple = false, disabled = false, error }) => {
  const { t } = useTranslation('cm');
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const chosen = Array.from(event.target.files ?? []);
    onChange(multiple ? [...files, ...chosen] : chosen.slice(0, 1));
    event.target.value = '';
  };

  return (
    <div className="cmm-filepick">
      <input ref={inputRef} type="file" multiple={multiple} accept={cmFileAccept(allowedTypes)} onChange={pick} disabled={disabled} aria-label={label} tabIndex={-1} />
      <MobileButton icon={<Paperclip aria-hidden="true" />} disabled={disabled} onClick={() => inputRef.current?.click()}>{label}</MobileButton>
      {files.length > 0 && (
        <ul className="cmm-filelist">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>{file.name}</span>
              <button type="button" className="cmm-icon-btn" aria-label={t('common.remove')} disabled={disabled} onClick={() => onChange(files.filter((_, position) => position !== index))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <small className="cmm-field__error" role="alert">{error}</small>}
    </div>
  );
};
