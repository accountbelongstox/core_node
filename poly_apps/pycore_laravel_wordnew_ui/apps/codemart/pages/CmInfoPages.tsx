import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Code2,
  DraftingCompass,
  History,
  LockKeyhole,
  Mail,
  ScrollText,
  Send,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmPublicApi } from '../api/CmPublicApi';
import { cmErrorMessage } from '../api/cmErrors';
import {
  CmPublicCardGrid,
  CmPublicChecklist,
  CmPublicFaq,
  CmPublicIllustration,
  CmPublicLink,
  CmPublicSection,
  CmPublicSplit,
  type CmPublicCardItem,
} from '../components/public-home/CmPublicBlocks';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import type { CmPublicImageName } from '../components/public-home/cmPublicImages';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';

interface CmContactDraft {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type CmContactField = keyof CmContactDraft;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_MESSAGE_MIN = 5;
const CONTACT_MESSAGE_MAX = 5000;
const CONTACT_NAME_MAX = 100;
const CONTACT_SUBJECT_MAX = 255;
const EMPTY_CONTACT: CmContactDraft = { name: '', email: '', subject: '', message: '' };

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <Briefcase />,
  developer: <Code2 />,
  architect: <DraftingCompass />,
  reviewer: <BadgeCheck />,
  administrator: <ShieldCheck />,
};

const CmInfoEyebrow: React.FC<{ pageId: string }> = ({ pageId }) => {
  const { t } = useTranslation('cm');
  return <>{t(`infoPages.${pageId}.eyebrow`)}</>;
};

const CmInfoLead: React.FC<{ pageId: string }> = ({ pageId }) => {
  const { t } = useTranslation('cm');
  return <>{t(`infoPages.${pageId}.lead`)}</>;
};

function validateContact(draft: CmContactDraft): Partial<Record<CmContactField, string>> {
  const errors: Partial<Record<CmContactField, string>> = {};
  if (!draft.name.trim()) errors.name = 'infoPages.contactForm.errors.nameRequired';
  else if (draft.name.trim().length > CONTACT_NAME_MAX) errors.name = 'infoPages.contactForm.errors.nameTooLong';
  if (!EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'infoPages.contactForm.errors.emailInvalid';
  if (draft.subject.trim().length > CONTACT_SUBJECT_MAX) errors.subject = 'infoPages.contactForm.errors.subjectTooLong';
  const messageLength = draft.message.trim().length;
  if (messageLength < CONTACT_MESSAGE_MIN) errors.message = 'infoPages.contactForm.errors.messageTooShort';
  else if (messageLength > CONTACT_MESSAGE_MAX) errors.message = 'infoPages.contactForm.errors.messageTooLong';
  return errors;
}

const CmContactForm: React.FC = () => {
  const { t } = useTranslation('cm');
  const [draft, setDraft] = useState<CmContactDraft>(EMPTY_CONTACT);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CmContactField, string>>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: CmContactField) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validateContact(draft);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const response = await cmPublicApi.submitContact({
      name: draft.name.trim(),
      email: draft.email.trim(),
      subject: draft.subject.trim() || undefined,
      message: draft.message.trim(),
    });
    setPending(false);
    if (response.success) {
      setSent(true);
      setDraft(EMPTY_CONTACT);
      return;
    }
    setError(response.status === 429
      ? t('infoPages.contactForm.throttled')
      : cmErrorMessage(t, response, 'infoPages.contactForm.failed'));
  };

  const fieldError = (field: CmContactField): React.ReactNode => (
    fieldErrors[field] ? <small className="cm-public-form__error" id={`cm-contact-${field}-error`}>{t(fieldErrors[field] as string)}</small> : null
  );

  return (
    <section className="cm-contact" aria-labelledby="cm-contact-title">
      <h2 id="cm-contact-title">{t('infoPages.contactForm.title')}</h2>
      <p>{t('infoPages.contactForm.lead')}</p>
      {sent ? (
        <div className="cm-public-form__notice is-success" role="status">
          <span>{t('infoPages.contactForm.success')}</span>
          <button type="button" className="cm-public-form__link" onClick={() => setSent(false)}>
            {t('infoPages.contactForm.sendAnother')}
          </button>
        </div>
      ) : (
        <form className="cm-public-form cm-public-form--two-column" onSubmit={(event) => void submit(event)} noValidate>
          <label>
            <span>{t('infoPages.contactForm.name')}</span>
            <input value={draft.name} onChange={update('name')} autoComplete="name" maxLength={CONTACT_NAME_MAX} aria-invalid={Boolean(fieldErrors.name)} aria-describedby="cm-contact-name-error" />
            {fieldError('name')}
          </label>
          <label>
            <span>{t('infoPages.contactForm.email')}</span>
            <input type="email" value={draft.email} onChange={update('email')} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby="cm-contact-email-error" />
            {fieldError('email')}
          </label>
          <label className="is-wide">
            <span>{t('infoPages.contactForm.subject')}</span>
            <input value={draft.subject} onChange={update('subject')} maxLength={CONTACT_SUBJECT_MAX} aria-invalid={Boolean(fieldErrors.subject)} aria-describedby="cm-contact-subject-error" />
            {fieldError('subject')}
          </label>
          <label className="is-wide">
            <span>{t('infoPages.contactForm.message')}</span>
            <textarea value={draft.message} onChange={update('message')} rows={6} maxLength={CONTACT_MESSAGE_MAX} aria-invalid={Boolean(fieldErrors.message)} aria-describedby="cm-contact-message-error" />
            {fieldError('message')}
          </label>
          {error && <p className="cm-public-form__notice is-error is-wide" role="alert">{error}</p>}
          <button type="submit" className="cm-public-button cm-public-button--primary cm-public-form__submit" disabled={pending}>
            <Send aria-hidden="true" /> {pending ? t('infoPages.contactForm.sending') : t('infoPages.contactForm.submit')}
          </button>
        </form>
      )}
    </section>
  );
};

type CmLegalPageId = 'privacy' | 'terms';

interface CmLegalSection {
  id: string;
  items?: string[];
}

const ABOUT_POINTS = ['brief', 'escrow', 'review'];
const ABOUT_ROLES: CmPublicCardItem[] = ['client', 'developer', 'architect', 'reviewer', 'administrator'].map((id) => ({
  id,
  icon: ROLE_ICONS[id],
  titleKey: `infoPages.about.roles.${id}.title`,
  bodyKey: `infoPages.about.roles.${id}.body`,
  metaKey: `infoPages.about.roles.${id}.gate`,
}));
const ABOUT_PRINCIPLES: CmPublicCardItem[] = [
  { id: 'server', icon: <ServerCog />, titleKey: 'infoPages.about.principles.server.title', bodyKey: 'infoPages.about.principles.server.body' },
  { id: 'ledger', icon: <ScrollText />, titleKey: 'infoPages.about.principles.ledger.title', bodyKey: 'infoPages.about.principles.ledger.body' },
  { id: 'privacy', icon: <LockKeyhole />, titleKey: 'infoPages.about.principles.privacy.title', bodyKey: 'infoPages.about.principles.privacy.body' },
  { id: 'audit', icon: <History />, titleKey: 'infoPages.about.principles.audit.title', bodyKey: 'infoPages.about.principles.audit.body' },
];

const DELIVERY_STAGES: Array<{ id: string; actor: string }> = [
  { id: 'brief', actor: 'client' },
  { id: 'analysis', actor: 'platform' },
  { id: 'proposal', actor: 'client' },
  { id: 'funding', actor: 'client' },
  { id: 'plan', actor: 'architect' },
  { id: 'marketplace', actor: 'developer' },
  { id: 'submission', actor: 'developer' },
  { id: 'review', actor: 'reviewer' },
  { id: 'approval', actor: 'client' },
];
const DELIVERY_STATUSES: CmPublicCardItem[] = ['project', 'task', 'submission'].map((id) => ({
  id,
  titleKey: `infoPages.delivery.statuses.${id}.title`,
  bodyKey: `infoPages.delivery.statuses.${id}.body`,
  metaKey: `infoPages.delivery.statuses.${id}.flow`,
}));
const DELIVERY_FAQ = ['revision', 'stalled', 'pause', 'refund'];

const SERVICE_FEATURES: Array<{ id: string; image: CmPublicImageName; action: { to: string; labelKey: string } }> = [
  { id: 'managed', image: 'service-managed', action: { to: CM_PROTECTED_ROUTE.projectCreate, labelKey: 'infoPages.services.managed.action' } },
  { id: 'marketplace', image: 'service-marketplace', action: { to: CM_PUBLIC_ROUTE.showcaseOpenWork, labelKey: 'infoPages.services.marketplace.action' } },
  { id: 'review', image: 'service-review', action: { to: CM_PUBLIC_ROUTE.delivery, labelKey: 'infoPages.services.review.action' } },
  { id: 'escrow', image: 'service-escrow', action: { to: CM_PUBLIC_ROUTE.estimate, labelKey: 'infoPages.services.escrow.action' } },
];
const SERVICE_POINTS = ['one', 'two', 'three'];
const SERVICES_FAQ = ['commission', 'deposit', 'invoice', 'withdrawal'];

const LEGAL_SECTIONS: Record<CmLegalPageId, CmLegalSection[]> = {
  privacy: [
    { id: 'collect', items: ['account', 'profile', 'identity', 'finance', 'delivery', 'contact'] },
    { id: 'use', items: ['operate', 'verify', 'money', 'notify', 'audit'] },
    { id: 'identity' },
    { id: 'visibility', items: ['public', 'parties', 'admins'] },
    { id: 'retention' },
    { id: 'rights' },
  ],
  terms: [
    { id: 'accounts' },
    { id: 'roles', items: ['client', 'developer', 'architect', 'reviewer'] },
    { id: 'projects' },
    { id: 'escrow', items: ['funding', 'release', 'commission'] },
    { id: 'refunds' },
    { id: 'withdrawals' },
    { id: 'conduct', items: ['fraud', 'deliverables', 'reviews', 'circumvent'] },
    { id: 'suspension' },
    { id: 'contact' },
  ],
};

const INFORMATION_TOPICS = ['account', 'deposit', 'project'];
const INFORMATION_LINKS: CmPublicCardItem[] = [
  { id: 'privacy', icon: <LockKeyhole />, titleKey: 'infoPages.information.links.privacy.title', bodyKey: 'infoPages.information.links.privacy.body', to: CM_PUBLIC_ROUTE.privacy, actionKey: 'infoPages.information.links.open' },
  { id: 'terms', icon: <ScrollText />, titleKey: 'infoPages.information.links.terms.title', bodyKey: 'infoPages.information.links.terms.body', to: CM_PUBLIC_ROUTE.terms, actionKey: 'infoPages.information.links.open' },
  { id: 'process', icon: <Workflow />, titleKey: 'infoPages.information.links.process.title', bodyKey: 'infoPages.information.links.process.body', to: CM_PUBLIC_ROUTE.delivery, actionKey: 'infoPages.information.links.open' },
];

export const CmAboutPage: React.FC = () => (
  <CmPublicPage titleKey="infoPages.about.title" descriptionKey="infoPages.about.lead" eyebrow={<CmInfoEyebrow pageId="about" />} lead={<CmInfoLead pageId="about" />}>
    <CmPublicSection>
      <CmPublicSplit
        image="about-mission"
        altKey="infoPages.about.intro.alt"
        eyebrowKey="infoPages.about.intro.eyebrow"
        titleKey="infoPages.about.intro.title"
        bodyKeys={['infoPages.about.intro.body1', 'infoPages.about.intro.body2']}
        pointKeys={ABOUT_POINTS.map((id) => `infoPages.about.intro.points.${id}`)}
        eager
      />
    </CmPublicSection>
    <CmPublicSection titleKey="infoPages.about.roles.title" leadKey="infoPages.about.roles.lead" tone="muted">
      <CmPublicCardGrid items={ABOUT_ROLES} columns={3} />
    </CmPublicSection>
    <CmPublicSection titleKey="infoPages.about.principles.title" leadKey="infoPages.about.principles.lead">
      <CmPublicCardGrid items={ABOUT_PRINCIPLES} columns={4} />
    </CmPublicSection>
    <CmPublicCta titleKey="infoPages.about.cta.title" bodyKey="infoPages.about.cta.body" />
  </CmPublicPage>
);

export const CmDeliveryProcessPage: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <CmPublicPage titleKey="infoPages.delivery.title" descriptionKey="infoPages.delivery.lead" eyebrow={<CmInfoEyebrow pageId="delivery" />} lead={<CmInfoLead pageId="delivery" />}>
      <CmPublicSection titleKey="infoPages.delivery.overview.title" leadKey="infoPages.delivery.overview.lead">
        <figure className="cm-public-figure">
          <CmPublicIllustration name="process-overview" altKey="infoPages.delivery.overview.alt" eager />
        </figure>
        <ol className="cm-public-timeline">
          {DELIVERY_STAGES.map((stage, index) => (
            <li key={stage.id}>
              <span className="cm-public-timeline__number" aria-hidden="true">{index + 1}</span>
              <div>
                <p className="cm-public-timeline__actor">{t(`infoPages.delivery.actors.${stage.actor}`)}</p>
                <h3>{t(`infoPages.delivery.stages.${stage.id}.title`)}</h3>
                <p>{t(`infoPages.delivery.stages.${stage.id}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </CmPublicSection>
      <CmPublicSection titleKey="infoPages.delivery.statuses.title" leadKey="infoPages.delivery.statuses.lead" tone="muted">
        <CmPublicCardGrid items={DELIVERY_STATUSES} columns={3} />
      </CmPublicSection>
      <CmPublicSection titleKey="infoPages.delivery.faq.title" narrow>
        <CmPublicFaq prefix="infoPages.delivery.faq" ids={DELIVERY_FAQ} />
      </CmPublicSection>
      <CmPublicCta titleKey="infoPages.delivery.cta.title" bodyKey="infoPages.delivery.cta.body" />
    </CmPublicPage>
  );
};

export const CmServicesPage: React.FC = () => (
  <CmPublicPage titleKey="infoPages.services.title" descriptionKey="infoPages.services.lead" eyebrow={<CmInfoEyebrow pageId="services" />} lead={<CmInfoLead pageId="services" />}>
    <CmPublicSection className="cm-public-split-list">
      {SERVICE_FEATURES.map((feature, index) => (
        <CmPublicSplit
          key={feature.id}
          id={`cm-service-${feature.id}`}
          image={feature.image}
          eyebrowKey={`infoPages.services.${feature.id}.eyebrow`}
          titleKey={`infoPages.services.${feature.id}.title`}
          bodyKeys={[`infoPages.services.${feature.id}.body`]}
          pointKeys={SERVICE_POINTS.map((point) => `infoPages.services.${feature.id}.points.${point}`)}
          reverse={index % 2 === 1}
          eager={index === 0}
          action={feature.action}
        />
      ))}
    </CmPublicSection>
    <CmPublicSection titleKey="infoPages.services.faq.title" tone="muted" narrow>
      <CmPublicFaq prefix="infoPages.services.faq" ids={SERVICES_FAQ} />
    </CmPublicSection>
    <CmPublicCta titleKey="infoPages.services.cta.title" bodyKey="infoPages.services.cta.body" />
  </CmPublicPage>
);

const CmLegalPage: React.FC<{ pageId: CmLegalPageId }> = ({ pageId }) => {
  const { t } = useTranslation('cm');
  const sections = LEGAL_SECTIONS[pageId];
  const prefix = `infoPages.${pageId}`;
  const jumpTo = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    document.getElementById(`cm-legal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <CmPublicPage titleKey={`${prefix}.title`} descriptionKey={`${prefix}.lead`} eyebrow={<CmInfoEyebrow pageId={pageId} />} lead={<CmInfoLead pageId={pageId} />}>
      <div className="cm-public-container cm-legal">
        <nav className="cm-legal__toc" aria-label={t('infoPages.legal.contents')}>
          <p>{t('infoPages.legal.contents')}</p>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#cm-legal-${section.id}`} onClick={jumpTo(section.id)}>{t(`${prefix}.sections.${section.id}.title`)}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="cm-legal__body">
          <p className="cm-legal__scope">{t('infoPages.legal.scope')}</p>
          {sections.map((section, index) => (
            <section key={section.id} id={`cm-legal-${section.id}`} className="cm-legal__section">
              <h2><span aria-hidden="true">{index + 1}.</span> {t(`${prefix}.sections.${section.id}.title`)}</h2>
              <p>{t(`${prefix}.sections.${section.id}.body`)}</p>
              {section.items && (
                <ul>
                  {section.items.map((item) => <li key={item}>{t(`${prefix}.sections.${section.id}.items.${item}`)}</li>)}
                </ul>
              )}
            </section>
          ))}
          <aside className="cm-legal__contact">
            <Mail aria-hidden="true" />
            <div>
              <h2>{t('infoPages.legal.questionsTitle')}</h2>
              <p>{t('infoPages.legal.questionsBody')}</p>
              <CmPublicLink to={CM_PUBLIC_ROUTE.information} className="cm-public-arrow-link">
                {t('infoPages.legal.questionsAction')} <ArrowRight aria-hidden="true" />
              </CmPublicLink>
            </div>
          </aside>
        </div>
      </div>
    </CmPublicPage>
  );
};

export const CmPrivacyPage: React.FC = () => <CmLegalPage pageId="privacy" />;
export const CmTermsPage: React.FC = () => <CmLegalPage pageId="terms" />;

export const CmInformationPage: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <CmPublicPage titleKey="infoPages.information.title" descriptionKey="infoPages.information.lead" eyebrow={<CmInfoEyebrow pageId="information" />} lead={<CmInfoLead pageId="information" />}>
      <CmPublicSection>
        <div className="cm-info-contact">
          <aside className="cm-info-contact__aside">
            <CmPublicIllustration name="contact-support" altKey="infoPages.information.contactAlt" eager className="cm-info-contact__image" />
            <h2>{t('infoPages.information.contactTitle')}</h2>
            <p>{t('infoPages.information.contactBody')}</p>
            <CmPublicChecklist keys={INFORMATION_TOPICS.map((id) => `infoPages.information.topics.${id}`)} />
            <p className="cm-public-card__meta">{t('infoPages.information.responseNote')}</p>
          </aside>
          <CmContactForm />
        </div>
      </CmPublicSection>
      <CmPublicSection titleKey="infoPages.information.links.title" leadKey="infoPages.information.links.lead" tone="muted">
        <CmPublicCardGrid items={INFORMATION_LINKS} columns={3} />
      </CmPublicSection>
    </CmPublicPage>
  );
};
