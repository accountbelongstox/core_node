import type { CmPageDef } from '../cmPages';

type CmHasCapability = (capability: string | null) => boolean;

export type CmAccessRole = 'client' | 'developer' | 'reviewer' | 'architect';

const CAPABILITY_ROLE: Record<string, CmAccessRole> = {
  'project.create': 'client',
  'task.browse': 'developer',
  'task.read': 'developer',
  'finance.withdraw': 'developer',
  'review.read': 'reviewer',
  'architect.read': 'architect',
};

/** The page is shown as the role application entry instead of the role workspace. */
export function cmIsApplyEntry(page: CmPageDef, hasCapability: CmHasCapability): boolean {
  return !hasCapability(page.capability) && page.applyCapability !== undefined && hasCapability(page.applyCapability);
}

export function cmCanOpenPage(page: CmPageDef, hasCapability: CmHasCapability): boolean {
  return hasCapability(page.capability) || cmIsApplyEntry(page, hasCapability);
}

/** The role that grants a capability, when a self-service path to it exists. */
export function cmRoleForCapability(capability: string | null): CmAccessRole | null {
  return capability ? CAPABILITY_ROLE[capability] ?? null : null;
}
