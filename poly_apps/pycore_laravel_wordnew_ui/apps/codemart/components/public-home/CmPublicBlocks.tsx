import React from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmPublicImage, type CmPublicImageName } from './cmPublicImages';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

export interface CmPublicIllustrationProps {
  name: CmPublicImageName;
  altKey?: string;
  eager?: boolean;
  className?: string;
}

/** Bundled illustration with localized alt text (empty when decorative) and fixed intrinsic size. */
export const CmPublicIllustration: React.FC<CmPublicIllustrationProps> = ({ name, altKey, eager = false, className }) => {
  const { t } = useTranslation('cm');
  const image = cmPublicImage(name);
  if (!image) return null;
  return (
    <img
      className={`cm-public-illustration ${className ?? ''}`}
      src={image.src}
      width={image.width}
      height={image.height}
      alt={altKey ? t(altKey) : ''}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
};

/** Link that opens public routes directly and protected routes through sign-in. */
export const CmPublicLink: React.FC<{ to: string; className?: string; children: React.ReactNode }> = ({ to, className, children }) => {
  const openLink = useCmProtectedNavigate();
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openLink(to);
      }}
    >
      {children}
    </a>
  );
};

export interface CmPublicSectionProps {
  id?: string;
  eyebrowKey?: string;
  titleKey?: string;
  leadKey?: string;
  tone?: 'plain' | 'muted';
  narrow?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Page section with an optional eyebrow, heading, and one-line lead. */
export const CmPublicSection: React.FC<CmPublicSectionProps> = ({
  id,
  eyebrowKey,
  titleKey,
  leadKey,
  tone = 'plain',
  narrow = false,
  className,
  children,
}) => {
  const { t } = useTranslation('cm');
  return (
    <section id={id} className={`cm-public-section is-${tone} ${className ?? ''}`}>
      <div className={`cm-public-container ${narrow ? 'is-narrow' : ''}`}>
        {(eyebrowKey || titleKey || leadKey) && (
          <header className="cm-public-section__header">
            {eyebrowKey && <p className="cm-public-section__eyebrow">{t(eyebrowKey)}</p>}
            {titleKey && <h2>{t(titleKey)}</h2>}
            {leadKey && <p className="cm-public-section__lead">{t(leadKey)}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
};

/** Bullet list whose items are translation keys. */
export const CmPublicChecklist: React.FC<{ keys: string[] }> = ({ keys }) => {
  const { t } = useTranslation('cm');
  if (keys.length === 0) return null;
  return (
    <ul className="cm-public-checklist">
      {keys.map((key) => (
        <li key={key}><Check aria-hidden="true" /><span>{t(key)}</span></li>
      ))}
    </ul>
  );
};

export interface CmPublicSplitProps {
  image: CmPublicImageName;
  altKey?: string;
  eyebrowKey?: string;
  titleKey: string;
  bodyKeys: string[];
  pointKeys?: string[];
  reverse?: boolean;
  eager?: boolean;
  action?: { to: string; labelKey: string };
  id?: string;
}

/** Two-column feature: illustration beside a heading, paragraphs, checklist, and optional link. */
export const CmPublicSplit: React.FC<CmPublicSplitProps> = ({
  image,
  altKey,
  eyebrowKey,
  titleKey,
  bodyKeys,
  pointKeys = [],
  reverse = false,
  eager = false,
  action,
  id,
}) => {
  const { t } = useTranslation('cm');
  return (
    <article id={id} className={`cm-public-split ${reverse ? 'is-reverse' : ''}`}>
      <div className="cm-public-split__media">
        <CmPublicIllustration name={image} altKey={altKey} eager={eager} />
      </div>
      <div className="cm-public-split__copy">
        {eyebrowKey && <p className="cm-public-section__eyebrow">{t(eyebrowKey)}</p>}
        <h3>{t(titleKey)}</h3>
        {bodyKeys.map((key) => <p key={key}>{t(key)}</p>)}
        <CmPublicChecklist keys={pointKeys} />
        {action && (
          <CmPublicLink to={action.to} className="cm-public-arrow-link">
            {t(action.labelKey)} <ArrowRight aria-hidden="true" />
          </CmPublicLink>
        )}
      </div>
    </article>
  );
};

export interface CmPublicCardItem {
  id: string;
  icon?: React.ReactNode;
  titleKey: string;
  bodyKey: string;
  metaKey?: string;
  image?: CmPublicImageName;
  to?: string;
  actionKey?: string;
}

/** Responsive card grid; cards may carry an icon, an illustration, a footnote, and a link. */
export const CmPublicCardGrid: React.FC<{ items: CmPublicCardItem[]; columns?: 2 | 3 | 4 }> = ({ items, columns = 3 }) => {
  const { t } = useTranslation('cm');
  return (
    <div className={`cm-public-cards is-cols-${columns}`}>
      {items.map((item) => (
        <article key={item.id} className={`cm-public-card ${item.image ? 'has-image' : ''}`}>
          {item.image && <CmPublicIllustration name={item.image} className="cm-public-card__image" />}
          {item.icon && <span className="cm-public-card__icon" aria-hidden="true">{item.icon}</span>}
          <h3>{t(item.titleKey)}</h3>
          <p>{t(item.bodyKey)}</p>
          {item.metaKey && <p className="cm-public-card__meta">{t(item.metaKey)}</p>}
          {item.to && item.actionKey && (
            <CmPublicLink to={item.to} className="cm-public-arrow-link">
              {t(item.actionKey)} <ArrowRight aria-hidden="true" />
            </CmPublicLink>
          )}
        </article>
      ))}
    </div>
  );
};

/** Frequently asked questions rendered as native disclosure widgets. */
export const CmPublicFaq: React.FC<{ prefix: string; ids: string[] }> = ({ prefix, ids }) => {
  const { t } = useTranslation('cm');
  return (
    <div className="cm-public-faq">
      {ids.map((id) => (
        <details key={id}>
          <summary>
            <span>{t(`${prefix}.${id}.question`)}</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>{t(`${prefix}.${id}.answer`)}</p>
        </details>
      ))}
    </div>
  );
};
