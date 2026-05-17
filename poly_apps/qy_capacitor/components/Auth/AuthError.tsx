import React from 'react';

interface AuthErrorProps {
  message: string;
  className?: string;
}

export const AuthError: React.FC<AuthErrorProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm ${className}`}>
      {message}
    </div>
  );
};

