import type { CmPageDef } from '../cmPages';

type CmHasCapability = (capability: string | null) => boolean;

/** The page is shown as the role application entry instead of the role workspace. */
export function cmIsApplyEntry(page: CmPageDef, hasCapability: CmHasCapability): boolean {
  return !hasCapability(page.capability) && page.applyCapability !== undefined && hasCapability(page.applyCapability);
}

export function cmCanOpenPage(page: CmPageDef, hasCapability: CmHasCapability): boolean {
  return hasCapability(page.capability) || cmIsApplyEntry(page, hasCapability);
}
