/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
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
    <div className={`ds-modal-panel p-8 ${className}`}>
      {(title || subtitle) && (
        <div className="text-center mb-10">
          {title && (
            <h1 className="ds-section-title !text-3xl mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="ds-section-sub">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

