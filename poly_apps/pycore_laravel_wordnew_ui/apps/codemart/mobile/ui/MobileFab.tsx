import React from 'react';
import { Link } from 'react-router-dom';

interface MobileFabProps {
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
}

/** Floating primary action, above the tab bar. */
export const MobileFab: React.FC<MobileFabProps> = ({ label, icon, to, onClick }) => {
  if (to) return <Link to={to} className="cmm-fab" aria-label={label}>{icon}<span>{label}</span></Link>;
  return <button type="button" className="cmm-fab" aria-label={label} onClick={onClick}>{icon}<span>{label}</span></button>;
};
