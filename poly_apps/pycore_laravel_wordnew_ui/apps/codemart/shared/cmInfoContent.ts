/** Content structure of the public information pages; the copy lives in the `infoPages` locale keys. */

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
