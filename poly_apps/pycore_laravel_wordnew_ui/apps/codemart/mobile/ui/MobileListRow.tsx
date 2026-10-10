import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface MobileListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  unread?: boolean;
  /** Show the navigation chevron (default for rows that link). */
  chevron?: boolean;
  danger?: boolean;
}

/** One tappable list row: leading visual, title with subtitle and meta, trailing badge or action. */
export const MobileListRow: React.FC<MobileListRowProps> = ({ title, subtitle, meta, leading, trailing, to, onClick, unread = false, chevron, danger = false }) => {
  const showChevron = chevron ?? Boolean(to);
  const content = (
    <>
      {leading && <span className="cmm-row__leading">{leading}</span>}
      <span className="cmm-row__body">
        <span className="cmm-row__title">{title}</span>
        {subtitle && <span className="cmm-row__subtitle">{subtitle}</span>}
        {meta && <span className="cmm-row__meta">{meta}</span>}
      </span>
      {trailing && <span className="cmm-row__trailing">{trailing}</span>}
      {showChevron && <ChevronRight className="cmm-row__chevron" aria-hidden="true" />}
    </>
  );
  const className = `cmm-row ${unread ? 'is-unread' : ''} ${danger ? 'is-danger' : ''}`.trim();
  if (to) return <Link to={to} className={className}>{content}</Link>;
  if (onClick) return <button type="button" className={className} onClick={onClick}>{content}</button>;
  return <div className={className}>{content}</div>;
};

/** Grouped rows in one rounded surface. */
export const MobileList: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <ul className="cmm-list" aria-label={label}>
    {React.Children.toArray(children).map((child, index) => <li key={index}>{child}</li>)}
  </ul>
);
