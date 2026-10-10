import React from 'react';
import { Link } from 'react-router-dom';

interface MobileEntityCardProps {
  kicker?: string;
  title: string;
  description?: string | null;
  badge?: React.ReactNode;
  /** Small facts under the title: dates, money, progress. */
  meta?: ReadonlyArray<React.ReactNode | null | false | undefined>;
  hint?: string;
  tags?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

/** Record card for project, task and review lists: kicker, title with status badge, clamped description, facts and hint. */
export const MobileEntityCard: React.FC<MobileEntityCardProps> = ({ kicker, title, description, badge, meta, hint, tags, to, onClick, children }) => {
  const facts = (meta ?? []).filter(Boolean);
  const content = (
    <>
      {kicker && <small className="cmm-entity__kicker">{kicker}</small>}
      <span className="cmm-entity__head"><h3>{title}</h3>{badge}</span>
      {description && <p className="cmm-entity__desc">{description}</p>}
      {facts.length > 0 && <span className="cmm-entity__meta">{facts.map((fact, index) => <span key={index}>{fact}</span>)}</span>}
      {tags}
      {hint && <p className="cmm-entity__hint">{hint}</p>}
      {children}
    </>
  );
  if (to) return <Link to={to} className="cmm-entity is-tappable">{content}</Link>;
  if (onClick) return <button type="button" className="cmm-entity is-tappable" onClick={onClick}>{content}</button>;
  return <article className="cmm-entity">{content}</article>;
};
