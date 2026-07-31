/**
 * WfNewAccountsStore — persisted /wordnew mock account registry, a sibling
 * subclass of the shared `PersistedStore`. Replaces the dynamic raw-localStorage
 * keys `wf_account_<email>` with ONE consolidated key holding a map of
 * lowercased-email → profile, accessed via getAccount/setAccount.
 */
import { PersistedStore, StorageManager } from '../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from './persistence/WordNewStorageKeys';

export interface WfNewAccountProfile {
  nickname: string;
  avatar: string;
  email: string;
  nativeLang: string;
  targetLang: string;
  bio: string;
  isLoggedIn: boolean;
}

export interface WfNewAccountsState {
  accounts: Record<string, WfNewAccountProfile>;
}

const makeDefaults = (): WfNewAccountsState => ({ accounts: {} });

class WfNewAccountsStore extends PersistedStore<WfNewAccountsState> {
  constructor() {
    super(StorageKeys.WORDNEW_ACCOUNTS, makeDefaults);
    this.migrateLegacyKeys();
  }

  getAccount(email: string): WfNewAccountProfile | null {
    return this.get('accounts')[email.toLowerCase()] ?? null;
  }

  setAccount(email: string, profile: WfNewAccountProfile): void {
    this.patch({ accounts: { ...this.get('accounts'), [email.toLowerCase()]: profile } });
  }

  private migrateLegacyKeys(): void {
    if (StorageManager.has(StorageKeys.WORDNEW_ACCOUNTS)) return;
    const accounts: Record<string, WfNewAccountProfile> = {};
    const stale: string[] = [];
    for (const { key, value } of StorageManager.listLegacyRaw('wf_account_')) {
      stale.push(key);
      try {
        const profile = JSON.parse(value);
        const email = (profile?.email || key.slice('wf_account_'.length)).toLowerCase();
        accounts[email] = profile;
      } catch { /* skip unparseable */ }
    }
    if (Object.keys(accounts).length > 0) this.patch({ accounts });
    StorageManager.removeLegacyRaw(stale);
  }
}

/** Global singleton — the one persisted account registry for /wordnew. */
export const wfNewAccounts = new WfNewAccountsStore();
