import React from 'react';
import { Link } from 'react-router-dom';
import { useCmPageTitle } from '../../../components/public-home/useCmPageTitle';

interface MobilePageHeadProps {
  titleKey: string;
  leadKey: string;
  icon?: React.ReactNode;
  eyebrow?: string;
}

/** Compact heading of a signed-out screen: icon, title and one lead line; also sets the document title. */
export const MobilePageHead: React.FC<MobilePageHeadProps & { title: string; lead: string }> = ({ titleKey, leadKey, title, lead, icon, eyebrow }) => {
  useCmPageTitle(titleKey, leadKey);
  return (
    <header className="cmm-a-head">
      {icon && <span className="cmm-a-head__icon">{icon}</span>}
      {eyebrow && <span className="cmm-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      <p>{lead}</p>
    </header>
  );
};

/** One line of secondary navigation under a form ("New here? Create an account"). */
export const MobileFormLinks: React.FC<{ links: Array<{ to: string; label: string }> }> = ({ links }) => (
  <nav className="cmm-a-links">
    {links.map((link) => <Link key={link.to} to={link.to} className="cmm-link-btn">{link.label}</Link>)}
  </nav>
);
