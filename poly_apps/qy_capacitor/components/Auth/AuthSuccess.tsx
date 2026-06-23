/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React from 'react';
import { Button, Icons } from '../UI';

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
    <div className="text-center py-10">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-emerald-500/10 text-emerald-500">
        <Icons.Check />
      </div>
      <h2 className="ds-section-title !text-xl mb-2">
        {title}
      </h2>
      <p className="text-[var(--color-text-secondary)] mb-8">
        {message}
      </p>
      {actionLabel && onAction && (
        <Button variant="grad" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
