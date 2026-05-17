import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';

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
    <button
      onClick={() => navigate(to)}
      className={`mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors ${className}`}
    >
      <span>←</span>
      <span>{label || t('common.back')}</span>
    </button>
  );
};

