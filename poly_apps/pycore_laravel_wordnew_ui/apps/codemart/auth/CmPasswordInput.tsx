import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';

export type CmPasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Password field with a show / hide toggle. */
export const CmPasswordInput: React.FC<CmPasswordInputProps> = (props) => {
  const { t } = useTranslation('cm');
  const [visible, setVisible] = useState(false);

  return (
    <span className="cm-password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="cm-password-field__toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={t(visible ? 'publicAuth.hidePassword' : 'publicAuth.showPassword')}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </span>
  );
};

export default CmPasswordInput;
