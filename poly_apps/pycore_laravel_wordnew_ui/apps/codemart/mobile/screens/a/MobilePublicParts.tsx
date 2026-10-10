import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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

/** Native disclosure list: one question or section per row, body revealed on tap. */
export const MobileAccordion: React.FC<{ items: Array<{ id: string; title: string; body: React.ReactNode }>; numbered?: boolean }> = ({ items, numbered = false }) => (
  <div className="cmm-a-acc">
    {items.map((item, index) => (
      <details key={item.id} id={`cmm-acc-${item.id}`}>
        <summary>
          <span>{numbered ? `${index + 1}. ` : ''}{item.title}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="cmm-a-acc__body">{item.body}</div>
      </details>
    ))}
  </div>
);

/** Section title with an optional one-line lead above a block of content. */
export const MobileBlock: React.FC<{ title?: string; lead?: string; children: React.ReactNode }> = ({ title, lead, children }) => (
  <section className="cmm-a-block">
    {(title || lead) && (
      <header>
        {title && <h3>{title}</h3>}
        {lead && <p>{lead}</p>}
      </header>
    )}
    {children}
  </section>
);
