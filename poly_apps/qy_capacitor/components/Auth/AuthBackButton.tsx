/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { BackButton } from '../UI';

interface AuthBackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export const AuthBackButton: React.FC<AuthBackButtonProps> = ({
  to = '/login',
  label,
  className = '',
}) => {
  const { navigate, t } = useContext(AppContext);

  return (
    <div className={`mb-6 -ml-2 ${className}`}>
      <BackButton onClick={() => navigate(to)} label={label || t('common.back')} />
    </div>
  );
};

