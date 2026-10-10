import { useMemo } from 'react';
import { Bell, ClipboardCheck, FolderKanban, House, ListChecks, ShieldCheck, Store, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import { CM_ADMIN_ROUTE, CM_PROTECTED_ROUTE } from '../../components/public-home/cmPublicRoutes';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';

/** Tab slots between the fixed Home tab and the fixed Alerts and Me tabs. */
const MAX_FLEX_TABS = 2;

export interface MobileTabDef {
  id: string;
  /** Matches the CM_PAGES id the tab opens. */
  pageId: string;
  path: string;
  labelKey: string;
  Icon: LucideIcon;
  badge: number;
}

interface TabTemplate {
  id: string;
  pageId: string;
  path: string;
  labelKey: string;
  Icon: LucideIcon;
}

const HOME_TAB: TabTemplate = { id: 'home', pageId: 'dashboard', path: CM_PROTECTED_ROUTE.dashboard, labelKey: 'mobile.tabs.home', Icon: House };
const ALERTS_TAB: TabTemplate = { id: 'notifications', pageId: 'notifications', path: CM_PROTECTED_ROUTE.notifications, labelKey: 'mobile.tabs.notifications', Icon: Bell };
const ME_TAB: TabTemplate = { id: 'me', pageId: 'profile', path: CM_PROTECTED_ROUTE.profile, labelKey: 'mobile.tabs.me', Icon: UserRound };

const ADMIN_TAB: TabTemplate = { id: 'admin', pageId: 'admin', path: CM_ADMIN_ROUTE.home, labelKey: 'mobile.tabs.admin', Icon: ShieldCheck };
const PROJECTS_TAB: TabTemplate = { id: 'projects', pageId: 'projects', path: CM_PROTECTED_ROUTE.projects, labelKey: 'mobile.tabs.projects', Icon: FolderKanban };
const MARKETPLACE_TAB: TabTemplate = { id: 'marketplace', pageId: 'marketplace', path: CM_PROTECTED_ROUTE.marketplace, labelKey: 'mobile.tabs.marketplace', Icon: Store };
const TASKS_TAB: TabTemplate = { id: 'tasks', pageId: 'tasks', path: CM_PROTECTED_ROUTE.tasks, labelKey: 'mobile.tabs.tasks', Icon: ListChecks };
const REVIEWS_TAB: TabTemplate = { id: 'reviews', pageId: 'reviews', path: CM_PROTECTED_ROUTE.reviews, labelKey: 'mobile.tabs.reviews', Icon: ClipboardCheck };
const WALLET_TAB: TabTemplate = { id: 'wallet', pageId: 'wallet', path: CM_PROTECTED_ROUTE.wallet, labelKey: 'mobile.tabs.wallet', Icon: Wallet };

/** Middle tab candidates in priority order, each with the capability that unlocks it. */
const FLEX_CANDIDATES: ReadonlyArray<{ capability: string; tab: TabTemplate }> = [
  { capability: 'admin.access', tab: ADMIN_TAB },
  { capability: 'project.create', tab: PROJECTS_TAB },
  { capability: 'task.browse', tab: MARKETPLACE_TAB },
  { capability: 'task.read', tab: TASKS_TAB },
  { capability: 'review.read', tab: REVIEWS_TAB },
  { capability: 'finance.read', tab: WALLET_TAB },
  { capability: 'project.read', tab: PROJECTS_TAB },
];

/** The bottom tabs for the signed-in account: Home, up to two work tabs by capability, Alerts (unread badge), Me. */
export function useMobileTabs(): MobileTabDef[] {
  const { hasCapability, unreadCount } = useCmBootstrap();
  const canNotify = hasCapability('notification.read');
  const canProfile = hasCapability('profile.read');

  return useMemo(() => {
    const flexSlots = MAX_FLEX_TABS + (canNotify ? 0 : 1) + (canProfile ? 0 : 1);
    const flex: TabTemplate[] = [];
    FLEX_CANDIDATES.forEach(({ capability, tab }) => {
      if (flex.length < flexSlots && hasCapability(capability) && !flex.some((item) => item.id === tab.id)) flex.push(tab);
    });
    const templates = [HOME_TAB, ...flex, ...(canNotify ? [ALERTS_TAB] : []), ...(canProfile ? [ME_TAB] : [])];
    return templates.map((tab) => ({ ...tab, badge: tab.id === ALERTS_TAB.id ? unreadCount : 0 }));
  }, [hasCapability, canNotify, canProfile, unreadCount]);
}
