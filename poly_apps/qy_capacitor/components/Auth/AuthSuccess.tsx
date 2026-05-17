import React from 'react';

interface AuthSuccessProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const AuthSuccess: React.FC<AuthSuccessProps> = ({
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">✓</span>
      </div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
        {title}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

