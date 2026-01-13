import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  children,
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`glass-panel bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 ${className}`}>
      {(title || subtitle) && (
        <div className="text-center mb-8">
          {title && (
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

