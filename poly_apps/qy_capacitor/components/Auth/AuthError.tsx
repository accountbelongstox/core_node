/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AuthErrorProps {
  message: string;
  className?: string;
}

export const AuthError: React.FC<AuthErrorProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-[var(--radius-button)] bg-red-500/10 border border-red-500/20 text-sm text-red-500 ${className}`}
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-px" aria-hidden />
      <span className="font-medium leading-snug">{message}</span>
    </div>
  );
};
