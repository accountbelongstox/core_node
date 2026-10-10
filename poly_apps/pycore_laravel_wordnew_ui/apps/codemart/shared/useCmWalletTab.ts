import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

export const CM_WALLET_TABS = ['transactions', 'deposits', 'payments', 'invoices', 'refunds', 'withdrawals'] as const;
export type CmWalletTab = typeof CM_WALLET_TABS[number];

const WITHDRAW_TAB: CmWalletTab = 'withdrawals';
const TAB_STORAGE_KEY = 'cm_wallet_tab';
const DEFAULT_TAB: CmWalletTab = 'transactions';

function readStoredTab(): CmWalletTab {
  try {
    const value = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    return (CM_WALLET_TABS as readonly string[]).includes(value ?? '') ? (value as CmWalletTab) : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
}

/** Wallet section selection: remembered for the session, and opened by `?tab=<name>` deep links. */
export function useCmWalletTab(): { tab: CmWalletTab; tabs: CmWalletTab[]; setTab: (tab: CmWalletTab) => void; canWithdraw: boolean } {
  const { hasCapability } = useCmBootstrap();
  const [searchParams] = useSearchParams();
  const canWithdraw = hasCapability('finance.withdraw');
  const [tab, setTabState] = useState<CmWalletTab>(readStoredTab);
  const tabs = CM_WALLET_TABS.filter((item) => item !== WITHDRAW_TAB || canWithdraw);

  const setTab = (next: CmWalletTab): void => {
    setTabState(next);
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: keep the in-memory tab */
    }
  };

  useEffect(() => {
    const requested = searchParams.get('tab');
    if ((CM_WALLET_TABS as readonly string[]).includes(requested ?? '') && requested !== tab) {
      setTab(requested as CmWalletTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return { tab: tabs.includes(tab) ? tab : tabs[0], tabs, setTab, canWithdraw };
}
