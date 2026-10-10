import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

export type MobilePasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/** Password input with a show / hide toggle, styled like `cmm-input`. */
export const MobilePasswordInput: React.FC<MobilePasswordInputProps> = (props) => {
  const { t } = useTranslation('cm');
  const [visible, setVisible] = useState(false);
  return (
    <span className="cmm-password">
      <input {...props} className="cmm-input" type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        className="cmm-password__toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={t(visible ? 'publicAuth.hidePassword' : 'publicAuth.showPassword')}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </span>
  );
};
