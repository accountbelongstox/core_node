import type { CmImageName } from '../assets/cmImageRegistry';
import type { CmProcessStepId } from '../components/public-home/CmProcessIllustration';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';

/** Content structure of the public home and information pages; the copy lives in the `publicHome` and `infoPages` locale keys. */

export const CM_HOME_HERO_SLIDES: ReadonlyArray<{ titleKey: string; subtitleKey: string; variant: string; image: CmImageName }> = [
  { titleKey: 'publicHome.hero.slide1Title', subtitleKey: 'publicHome.hero.slide1Subtitle', variant: 'delivery', image: 'hero-delivery' },
  { titleKey: 'publicHome.hero.slide2Title', subtitleKey: 'publicHome.hero.slide2Subtitle', variant: 'milestones', image: 'hero-marketplace' },
  { titleKey: 'publicHome.hero.slide3Title', subtitleKey: 'publicHome.hero.slide3Subtitle', variant: 'specialists', image: 'hero-escrow' },
];

export const CM_HOME_ROLE_IDS = ['client', 'developer', 'architect', 'reviewer'];

export const CM_HOME_PROCESS_STEPS: Array<{
  id: CmProcessStepId;
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  route: string;
}> = [
  { id: 'brief', titleKey: 'publicHome.process.briefTitle', bodyKey: 'publicHome.process.briefBody', actionKey: 'publicHome.process.briefAction', route: CM_PROTECTED_ROUTE.projectCreate },
  { id: 'proposal', titleKey: 'publicHome.process.proposalTitle', bodyKey: 'publicHome.process.proposalBody', actionKey: 'publicHome.process.proposalAction', route: CM_PROTECTED_ROUTE.projects },
  { id: 'funding', titleKey: 'publicHome.process.fundingTitle', bodyKey: 'publicHome.process.fundingBody', actionKey: 'publicHome.process.fundingAction', route: CM_PUBLIC_ROUTE.services },
  { id: 'marketplace', titleKey: 'publicHome.process.marketplaceTitle', bodyKey: 'publicHome.process.marketplaceBody', actionKey: 'publicHome.process.marketplaceAction', route: CM_PUBLIC_ROUTE.showcaseOpenWork },
  { id: 'review', titleKey: 'publicHome.process.reviewTitle', bodyKey: 'publicHome.process.reviewBody', actionKey: 'publicHome.process.reviewAction', route: CM_PUBLIC_ROUTE.delivery },
];

export type CmLegalPageId = 'privacy' | 'terms';

export interface CmLegalSection {
  id: string;
  items?: string[];
}

export const CM_ABOUT_POINTS = ['brief', 'escrow', 'review'];
export const CM_ABOUT_ROLE_IDS = ['client', 'developer', 'architect', 'reviewer', 'administrator'];
export const CM_ABOUT_PRINCIPLE_IDS = ['server', 'ledger', 'privacy', 'audit'];

export const CM_DELIVERY_STAGES: Array<{ id: string; actor: string }> = [
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
export const CM_DELIVERY_STATUS_IDS = ['project', 'task', 'submission'];
export const CM_DELIVERY_FAQ = ['revision', 'stalled', 'pause', 'refund'];

export const CM_SERVICE_IDS = ['managed', 'marketplace', 'review', 'escrow'];
export const CM_SERVICE_POINTS = ['one', 'two', 'three'];
export const CM_SERVICES_FAQ = ['commission', 'deposit', 'invoice', 'withdrawal'];

export const CM_LEGAL_SECTIONS: Record<CmLegalPageId, CmLegalSection[]> = {
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

export const CM_INFORMATION_TOPICS = ['account', 'deposit', 'project'];
export const CM_INFORMATION_LINK_IDS = ['privacy', 'terms', 'process'];
