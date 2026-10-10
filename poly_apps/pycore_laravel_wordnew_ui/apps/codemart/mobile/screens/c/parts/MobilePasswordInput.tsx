import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';

type MobilePasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/** Password field in the mobile input style with a show / hide toggle. */
export const MobilePasswordInput: React.FC<MobilePasswordInputProps> = (props) => {
  const { t } = useTranslation('cm');
  const [visible, setVisible] = useState(false);
  return (
    <span className="cmmc-password">
      <input {...props} className="cmm-input" type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="cmm-icon-btn"
        aria-pressed={visible}
        aria-label={t(visible ? 'publicAuth.hidePassword' : 'publicAuth.showPassword')}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </span>
  );
};
