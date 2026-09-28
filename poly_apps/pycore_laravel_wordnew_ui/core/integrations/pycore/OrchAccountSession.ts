import { StorageManager } from '../../persistence';
import { LaravelQyAccountAPI, type QyAccountCredentials } from '../laravel/LaravelQyAccountAPI';
import { resolveLaravelBaseURL } from '../laravel/LaravelRequest';
import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';
import { pycoreTargetBackendUrl } from './pycoreTarget';
import { laravelRelayDeviceId } from './PycoreLaravelRelayTransport';
import { PycoreStorageKeys } from './PycoreStorageKeys';
import type { OrchAuthStatus } from './PycoreApiOrchestration';

type StoredAccount = QyAccountCredentials & { username: string; logged_at: number };
type StoredAccounts = Record<string, StoredAccount | null>;
type PendingLogout = { backend: string; device_id: string | null; user_id?: number };

class OrchAccountSession {
  private syncedTarget: string | null = null;
  private syncedToken: string | null = null;
  private syncFlight: Promise<OrchAuthStatus> | null = null;
  private generation = 0;
  private syncError: string | null = null;

  private pendingLogout(): PendingLogout | null {
    return StorageManager.get<Record<string, PendingLogout>>(PycoreStorageKeys.QY_PENDING_LOGOUTS, {})[resolveLaravelBaseURL()] || null;
  }

  private clearPendingLogout(baseURL: string): void {
    const pending = StorageManager.get<Record<string, PendingLogout>>(PycoreStorageKeys.QY_PENDING_LOGOUTS, {});
    delete pending[baseURL];
    StorageManager.set(PycoreStorageKeys.QY_PENDING_LOGOUTS, pending);
  }

  private account(): StoredAccount | null {
    return StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {})[resolveLaravelBaseURL()] || null;
  }

  private targetKey(): string {
    return `${resolveLaravelBaseURL()}:${pycoreTargetBackendUrl()}:${laravelRelayDeviceId() || ''}`;
  }

  async login(username: string, password: string): Promise<OrchAuthStatus> {
    const baseURL = resolveLaravelBaseURL();
    const generation = ++this.generation;
    const credentials = await new LaravelQyAccountAPI(baseURL).login(username, password);
    const accounts = StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {});
    if (generation !== this.generation || resolveLaravelBaseURL() !== baseURL) throw new DOMException('Aborted', 'AbortError');
    accounts[baseURL] = { ...credentials, username: credentials.user.username || username, logged_at: Date.now() / 1000 };
    StorageManager.set(PycoreStorageKeys.QY_ACCOUNTS, accounts);
    if (this.syncFlight) await this.syncFlight;
    if (generation !== this.generation) throw new DOMException('Aborted', 'AbortError');
    this.syncedTarget = null;
    this.syncedToken = null;
    this.clearPendingLogout(baseURL);
    this.syncError = null;
    return this.sync();
  }

  async status(): Promise<OrchAuthStatus> {
    const account = this.account();
    const accounts = StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {});
    const baseURL = resolveLaravelBaseURL();
    if (account) return this.describe(account);
    if (this.pendingLogout()) return { success: true, logged_in: false, sync_error: this.syncError || 'QY_ACCOUNT_LOGOUT_PENDING' };
    if (Object.prototype.hasOwnProperty.call(accounts, resolveLaravelBaseURL())) return { success: true, logged_in: false };
    const status = await requestPycoreHttp(PYCORE_HTTP_ROUTES.audioOrchAuthStatus, {}) as OrchAuthStatus;
    const current = this.account();
    const updated = StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {});
    if (current) return this.describe(current);
    if (baseURL !== resolveLaravelBaseURL() || Object.prototype.hasOwnProperty.call(updated, baseURL)) {
      return { success: true, logged_in: false };
    }
    return status;
  }

  async sync(force = false): Promise<OrchAuthStatus> {
    if (this.syncFlight) return this.syncFlight;
    if (force) this.syncedTarget = null;
    const account = this.account();
    const logout = this.pendingLogout();
    const generation = this.generation;
    const target = this.targetKey();
    const backend = pycoreTargetBackendUrl();
    const baseURL = resolveLaravelBaseURL();
    const deviceId = laravelRelayDeviceId();
    if (!account && !logout) return this.status();
    if (!account && logout && (logout.backend !== backend || (logout.device_id && logout.device_id !== deviceId))) {
      this.syncError = 'QY_ACCOUNT_LOGOUT_TARGET_CHANGED';
      return { success: true, logged_in: false, sync_error: this.syncError };
    }
    if (account && this.syncedTarget === target && this.syncedToken === account.token) return this.describe(account);
    const flight = (async (): Promise<OrchAuthStatus> => {
      try {
        const response = await requestPycoreHttp(
          account ? PYCORE_HTTP_ROUTES.audioOrchAuthLogin : PYCORE_HTTP_ROUTES.audioOrchAuthLogout,
          account ? { access_token: account.token, laravel_base_url: baseURL } : { expected_user_id: logout?.user_id },
          90_000,
        ) as OrchAuthStatus & { error?: string; error_code?: string };
        if (generation !== this.generation || backend !== pycoreTargetBackendUrl()
          || baseURL !== resolveLaravelBaseURL() || (deviceId && deviceId !== laravelRelayDeviceId())) {
          throw new DOMException('Aborted', 'AbortError');
        }
        if (!response.success) throw new Error(response.error_code === 'QY_ACCOUNT_AUTH_REQUIRED'
          ? response.error_code : response.error || 'QY_ACCOUNT_MACHINE_SYNC_FAILED');
        this.syncedTarget = this.targetKey();
        this.syncedToken = account?.token || null;
        this.syncError = null;
        this.clearPendingLogout(baseURL);
      } catch (error) {
        if (generation === this.generation && baseURL === resolveLaravelBaseURL() && backend === pycoreTargetBackendUrl()) {
          this.syncError = error instanceof Error ? error.message : 'QY_ACCOUNT_MACHINE_SYNC_FAILED';
        }
      }
      const current = this.account();
      return current ? this.describe(current) : { success: true, logged_in: false, sync_error: this.pendingLogout() ? this.syncError || 'QY_ACCOUNT_LOGOUT_PENDING' : undefined };
    })().finally(() => {
      if (this.syncFlight === flight) this.syncFlight = null;
    });
    this.syncFlight = flight;
    return flight;
  }

  async requireSynced(): Promise<void> {
    if (!this.account() && !this.pendingLogout()) return;
    const status = await this.sync(true);
    if (status.sync_error) throw new Error(status.sync_error);
  }

  generationAccount(): { expected_user_id?: number; expected_base_url?: string; use_qy_account?: boolean } {
    const account = this.account();
    const baseURL = resolveLaravelBaseURL();
    const accounts = StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {});
    return account ? { expected_user_id: account.user.id, expected_base_url: baseURL, use_qy_account: true }
      : Object.prototype.hasOwnProperty.call(accounts, baseURL) ? { use_qy_account: false } : {};
  }

  async logout(): Promise<OrchAuthStatus> {
    const account = this.account();
    const baseURL = resolveLaravelBaseURL();
    const accounts = StorageManager.get<StoredAccounts>(PycoreStorageKeys.QY_ACCOUNTS, {});
    const pending = StorageManager.get<Record<string, PendingLogout>>(PycoreStorageKeys.QY_PENDING_LOGOUTS, {});
    ++this.generation;
    accounts[baseURL] = null;
    StorageManager.set(PycoreStorageKeys.QY_ACCOUNTS, accounts);
    this.syncedTarget = null;
    this.syncedToken = null;
    pending[baseURL] = { backend: pycoreTargetBackendUrl(), device_id: laravelRelayDeviceId(), user_id: account?.user.id };
    StorageManager.set(PycoreStorageKeys.QY_PENDING_LOGOUTS, pending);
    if (this.syncFlight) await this.syncFlight;
    return this.sync();
  }

  private describe(account: StoredAccount): OrchAuthStatus {
    const synced = this.syncedTarget === this.targetKey() && this.syncedToken === account.token;
    return {
      success: true, logged_in: true, username: account.username,
      user: account.user, logged_at: account.logged_at,
      machine_synced: synced,
      sync_error: synced ? undefined : this.syncError || 'QY_ACCOUNT_MACHINE_SYNC_PENDING',
    };
  }
}

export const orchAccountSession = new OrchAccountSession();
