import React from 'react';
import { Link } from 'react-router-dom';

interface MobileStatChipProps {
  label: string;
  value: string;
  tone?: string;
  icon?: React.ReactNode;
  to?: string;
  onClick?: () => void;
}

/** Compact metric tile (value over label); a row of them scrolls sideways. */
export const MobileStatChip: React.FC<MobileStatChipProps> = ({ label, value, tone = 'blue', icon, to, onClick }) => {
  const content = (
    <>
      {icon && <span className="cmm-chip__icon">{icon}</span>}
      <span className="cmm-chip__value">{value}</span>
      <span className="cmm-chip__label">{label}</span>
    </>
  );
  if (to) return <Link to={to} className="cmm-chip" data-tone={tone}>{content}</Link>;
  if (onClick) return <button type="button" className="cmm-chip" data-tone={tone} onClick={onClick}>{content}</button>;
  return <div className="cmm-chip" data-tone={tone}>{content}</div>;
};

export const MobileChipRow: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <div className="cmm-chip-row" role="list" aria-label={label}>{children}</div>
);
