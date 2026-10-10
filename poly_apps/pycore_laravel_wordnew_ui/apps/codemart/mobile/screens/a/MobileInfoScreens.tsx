import React from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  Code2,
  DraftingCompass,
  History,
  Info,
  LockKeyhole,
  Mail,
  ScrollText,
  Send,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CmImage } from '../../../components/CmImage';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../../../components/public-home/useCmProtectedNavigate';
import {
  CM_ABOUT_POINTS,
  CM_ABOUT_PRINCIPLE_IDS,
  CM_ABOUT_ROLE_IDS,
  CM_DELIVERY_FAQ,
  CM_DELIVERY_STAGES,
  CM_DELIVERY_STATUS_IDS,
  CM_INFORMATION_LINK_IDS,
  CM_INFORMATION_TOPICS,
  CM_LEGAL_SECTIONS,
  CM_SERVICE_IDS,
  CM_SERVICE_POINTS,
  CM_SERVICES_FAQ,
  type CmLegalPageId,
} from '../../../shared/cmInfoContent';
import {
  CM_CONTACT_MESSAGE_MAX,
  CM_CONTACT_NAME_MAX,
  CM_CONTACT_SUBJECT_MAX,
  useCmContactForm,
  type CmContactField,
} from '../../../shared/useCmContactForm';
import { MobileButton, MobileCard, MobileField, MobileList, MobileListRow, MobileNotice, MobileScreen } from '../../ui';
import { MobileAccordion, MobileBlock, MobilePageHead } from './MobilePublicParts';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <Briefcase aria-hidden="true" />,
  developer: <Code2 aria-hidden="true" />,
  architect: <DraftingCompass aria-hidden="true" />,
  reviewer: <BadgeCheck aria-hidden="true" />,
  administrator: <ShieldCheck aria-hidden="true" />,
};
const PRINCIPLE_ICONS: Record<string, React.ReactNode> = {
  server: <ServerCog aria-hidden="true" />,
  ledger: <ScrollText aria-hidden="true" />,
  privacy: <LockKeyhole aria-hidden="true" />,
  audit: <History aria-hidden="true" />,
};
const INFORMATION_LINK_TARGETS: Record<string, { to: string; icon: React.ReactNode }> = {
  privacy: { to: CM_PUBLIC_ROUTE.privacy, icon: <LockKeyhole aria-hidden="true" /> },
  terms: { to: CM_PUBLIC_ROUTE.terms, icon: <ScrollText aria-hidden="true" /> },
  process: { to: CM_PUBLIC_ROUTE.delivery, icon: <Workflow aria-hidden="true" /> },
};
const SERVICE_ACTIONS: Record<string, string> = {
  managed: CM_PROTECTED_ROUTE.projectCreate,
  marketplace: CM_PUBLIC_ROUTE.showcaseOpenWork,
  review: CM_PUBLIC_ROUTE.delivery,
  escrow: CM_PUBLIC_ROUTE.estimate,
};

const PageHead: React.FC<{ pageId: string; icon?: React.ReactNode }> = ({ pageId, icon }) => {
  const { t } = useTranslation('cm');
  return (
    <MobilePageHead
      titleKey={`infoPages.${pageId}.title`}
      leadKey={`infoPages.${pageId}.lead`}
      title={t(`infoPages.${pageId}.title`)}
      lead={t(`infoPages.${pageId}.lead`)}
      eyebrow={t(`infoPages.${pageId}.eyebrow`)}
      icon={icon}
    />
  );
};

const Checklist: React.FC<{ keys: string[] }> = ({ keys }) => {
  const { t } = useTranslation('cm');
  return (
    <ul className="cmm-a-checks">
      {keys.map((key) => <li key={key}>{t(key)}</li>)}
    </ul>
  );
};

const Cta: React.FC<{ prefix: string; to?: string; actionKey?: string }> = ({ prefix, to = CM_PROTECTED_ROUTE.projectCreate, actionKey = 'publicHome.finalCta.action' }) => {
  const { t } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  return (
    <MobileCard tone="accent" className="cmm-a-cta">
      <h3>{t(`${prefix}.title`)}</h3>
      <p>{t(`${prefix}.body`)}</p>
      <MobileButton variant="primary" block onClick={() => openProtected(to, 'info-cta')}>{t(actionKey)}</MobileButton>
    </MobileCard>
  );
};

export const MobileAboutScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileScreen>
      <PageHead pageId="about" icon={<Info aria-hidden="true" />} />
      <MobileCard className="cmm-a-prose">
        <CmImage name="about-mission" className="cmm-a-prose__image" eager />
        <h3>{t('infoPages.about.intro.title')}</h3>
        <p>{t('infoPages.about.intro.body1')}</p>
        <p>{t('infoPages.about.intro.body2')}</p>
        <Checklist keys={CM_ABOUT_POINTS.map((id) => `infoPages.about.intro.points.${id}`)} />
      </MobileCard>
      <MobileBlock title={t('infoPages.about.roles.title')} lead={t('infoPages.about.roles.lead')}>
        <MobileList>
          {CM_ABOUT_ROLE_IDS.map((id) => (
            <MobileListRow
              key={id}
              leading={ROLE_ICONS[id]}
              title={t(`infoPages.about.roles.${id}.title`)}
              subtitle={t(`infoPages.about.roles.${id}.body`)}
              meta={t(`infoPages.about.roles.${id}.gate`)}
            />
          ))}
        </MobileList>
      </MobileBlock>
      <MobileBlock title={t('infoPages.about.principles.title')} lead={t('infoPages.about.principles.lead')}>
        <MobileList>
          {CM_ABOUT_PRINCIPLE_IDS.map((id) => (
            <MobileListRow
              key={id}
              leading={PRINCIPLE_ICONS[id]}
              title={t(`infoPages.about.principles.${id}.title`)}
              subtitle={t(`infoPages.about.principles.${id}.body`)}
            />
          ))}
        </MobileList>
      </MobileBlock>
      <Cta prefix="infoPages.about.cta" />
    </MobileScreen>
  );
};

export const MobileDeliveryProcessScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileScreen>
      <PageHead pageId="delivery" icon={<Workflow aria-hidden="true" />} />
      <MobileBlock title={t('infoPages.delivery.overview.title')} lead={t('infoPages.delivery.overview.lead')}>
        <CmImage name="process-overview" className="cmm-a-prose__image" eager />
        <ol className="cmm-a-steps">
          {CM_DELIVERY_STAGES.map((stage, index) => (
            <li key={stage.id}>
              <span className="cmm-a-steps__number" aria-hidden="true">{index + 1}</span>
              <div>
                <small>{t(`infoPages.delivery.actors.${stage.actor}`)}</small>
                <strong>{t(`infoPages.delivery.stages.${stage.id}.title`)}</strong>
                <p>{t(`infoPages.delivery.stages.${stage.id}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </MobileBlock>
      <MobileBlock title={t('infoPages.delivery.statuses.title')} lead={t('infoPages.delivery.statuses.lead')}>
        <MobileList>
          {CM_DELIVERY_STATUS_IDS.map((id) => (
            <MobileListRow
              key={id}
              title={t(`infoPages.delivery.statuses.${id}.title`)}
              subtitle={t(`infoPages.delivery.statuses.${id}.body`)}
              meta={t(`infoPages.delivery.statuses.${id}.flow`)}
            />
          ))}
        </MobileList>
      </MobileBlock>
      <MobileBlock title={t('infoPages.delivery.faq.title')}>
        <MobileAccordion items={CM_DELIVERY_FAQ.map((id) => ({ id: `delivery-${id}`, title: t(`infoPages.delivery.faq.${id}.question`), body: t(`infoPages.delivery.faq.${id}.answer`) }))} />
      </MobileBlock>
      <Cta prefix="infoPages.delivery.cta" />
    </MobileScreen>
  );
};

export const MobileServicesScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  return (
    <MobileScreen>
      <PageHead pageId="services" icon={<ShieldCheck aria-hidden="true" />} />
      {CM_SERVICE_IDS.map((id) => (
        <MobileCard key={id} className="cmm-a-prose">
          <CmImage name={`service-${id}` as 'service-managed'} className="cmm-a-prose__image" />
          <span className="cmm-eyebrow">{t(`infoPages.services.${id}.eyebrow`)}</span>
          <h3>{t(`infoPages.services.${id}.title`)}</h3>
          <p>{t(`infoPages.services.${id}.body`)}</p>
          <Checklist keys={CM_SERVICE_POINTS.map((point) => `infoPages.services.${id}.points.${point}`)} />
          <MobileButton small block onClick={() => openProtected(SERVICE_ACTIONS[id], 'services-action')}>{t(`infoPages.services.${id}.action`)}</MobileButton>
        </MobileCard>
      ))}
      <MobileBlock title={t('infoPages.services.faq.title')}>
        <MobileAccordion items={CM_SERVICES_FAQ.map((id) => ({ id: `services-${id}`, title: t(`infoPages.services.faq.${id}.question`), body: t(`infoPages.services.faq.${id}.answer`) }))} />
      </MobileBlock>
      <Cta prefix="infoPages.services.cta" />
    </MobileScreen>
  );
};

const MobileLegalScreen: React.FC<{ pageId: CmLegalPageId }> = ({ pageId }) => {
  const { t } = useTranslation('cm');
  const prefix = `infoPages.${pageId}`;
  return (
    <MobileScreen>
      <PageHead pageId={pageId} icon={<ScrollText aria-hidden="true" />} />
      <p className="cmm-summary">{t('infoPages.legal.scope')}</p>
      <MobileAccordion
        numbered
        items={CM_LEGAL_SECTIONS[pageId].map((section) => ({
          id: `${pageId}-${section.id}`,
          title: t(`${prefix}.sections.${section.id}.title`),
          body: (
            <>
              <p>{t(`${prefix}.sections.${section.id}.body`)}</p>
              {section.items && <ul>{section.items.map((item) => <li key={item}>{t(`${prefix}.sections.${section.id}.items.${item}`)}</li>)}</ul>}
            </>
          ),
        }))}
      />
      <MobileCard className="cmm-a-prose">
        <h3>{t('infoPages.legal.questionsTitle')}</h3>
        <p>{t('infoPages.legal.questionsBody')}</p>
        <Link className="cmm-link-btn" to={CM_PUBLIC_ROUTE.information}><Mail aria-hidden="true" />{t('infoPages.legal.questionsAction')}</Link>
      </MobileCard>
    </MobileScreen>
  );
};

export const MobilePrivacyScreen: React.FC = () => <MobileLegalScreen pageId="privacy" />;
export const MobileTermsScreen: React.FC = () => <MobileLegalScreen pageId="terms" />;

const MobileContactForm: React.FC = () => {
  const { t } = useTranslation('cm');
  const contact = useCmContactForm();
  const { draft, fieldErrors, pending, sent, error } = contact;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void contact.submit();
  };
  const errorText = (field: CmContactField): string | undefined => (fieldErrors[field] ? t(fieldErrors[field] as string) : undefined);
  const bind = (field: CmContactField) => ({
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => contact.update(field, event.target.value),
    'aria-invalid': Boolean(fieldErrors[field]),
  });

  return (
    <MobileBlock title={t('infoPages.contactForm.title')} lead={t('infoPages.contactForm.lead')}>
      {sent ? (
        <MobileNotice tone="success" action={<button type="button" className="cmm-link-btn" onClick={contact.sendAnother}>{t('infoPages.contactForm.sendAnother')}</button>}>
          {t('infoPages.contactForm.success')}
        </MobileNotice>
      ) : (
        <MobileCard>
          <form className="cmm-a-form" onSubmit={submit} noValidate>
            <MobileField label={t('infoPages.contactForm.name')} error={errorText('name')}>
              <input className="cmm-input" {...bind('name')} autoComplete="name" maxLength={CM_CONTACT_NAME_MAX} />
            </MobileField>
            <MobileField label={t('infoPages.contactForm.email')} error={errorText('email')}>
              <input className="cmm-input" {...bind('email')} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </MobileField>
            <MobileField label={t('infoPages.contactForm.subject')} error={errorText('subject')}>
              <input className="cmm-input" {...bind('subject')} maxLength={CM_CONTACT_SUBJECT_MAX} />
            </MobileField>
            <MobileField label={t('infoPages.contactForm.message')} error={errorText('message')}>
              <textarea className="cmm-input cmm-a-textarea" {...bind('message')} rows={5} maxLength={CM_CONTACT_MESSAGE_MAX} />
            </MobileField>
            {error && <MobileNotice tone="error">{error}</MobileNotice>}
            <MobileButton type="submit" variant="primary" block loading={pending} icon={<Send aria-hidden="true" />}>
              {pending ? t('infoPages.contactForm.sending') : t('infoPages.contactForm.submit')}
            </MobileButton>
          </form>
        </MobileCard>
      )}
    </MobileBlock>
  );
};

export const MobileInformationScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileScreen>
      <PageHead pageId="information" icon={<Mail aria-hidden="true" />} />
      <MobileCard className="cmm-a-prose">
        <h3>{t('infoPages.information.contactTitle')}</h3>
        <p>{t('infoPages.information.contactBody')}</p>
        <Checklist keys={CM_INFORMATION_TOPICS.map((id) => `infoPages.information.topics.${id}`)} />
        <p className="cmm-a-fine">{t('infoPages.information.responseNote')}</p>
      </MobileCard>
      <MobileContactForm />
      <MobileBlock title={t('infoPages.information.links.title')} lead={t('infoPages.information.links.lead')}>
        <MobileList>
          {CM_INFORMATION_LINK_IDS.map((id) => (
            <MobileListRow
              key={id}
              to={INFORMATION_LINK_TARGETS[id].to}
              leading={INFORMATION_LINK_TARGETS[id].icon}
              title={t(`infoPages.information.links.${id}.title`)}
              subtitle={t(`infoPages.information.links.${id}.body`)}
            />
          ))}
        </MobileList>
      </MobileBlock>
    </MobileScreen>
  );
};
