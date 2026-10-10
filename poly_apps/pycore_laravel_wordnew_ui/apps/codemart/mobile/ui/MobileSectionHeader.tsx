import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface MobileSectionHeaderProps {
  title: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

export const MobileSectionHeader: React.FC<MobileSectionHeaderProps> = ({ title, actionLabel, actionTo, onAction }) => (
  <header className="cmm-section-head">
    <h2>{title}</h2>
    {actionLabel && actionTo && <Link to={actionTo} className="cmm-section-head__action">{actionLabel}<ChevronRight aria-hidden="true" /></Link>}
    {actionLabel && !actionTo && onAction && <button type="button" className="cmm-section-head__action" onClick={onAction}>{actionLabel}</button>}
  </header>
);
