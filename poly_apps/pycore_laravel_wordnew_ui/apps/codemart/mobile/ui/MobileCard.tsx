import React from 'react';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  /** No inner padding, for lists and media that run edge to edge. */
  flush?: boolean;
  tone?: 'default' | 'accent';
}

export const MobileCard: React.FC<MobileCardProps> = ({ children, className = '', flush = false, tone = 'default' }) => (
  <section className={`cmm-card ${flush ? 'is-flush' : ''} ${className}`.trim()} data-tone={tone}>{children}</section>
);
