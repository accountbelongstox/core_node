import { DatabaseManagerAPI, DataSyncApiError } from '../api/modules/DatabaseManagerAPI';
import type {
  DataSyncProbeResult,
  DataSyncSession,
  DataSyncStartRequest,
} from '../api/modules/DatabaseManagerAPI';
import { AuthAPI } from '../api/modules/AuthAPI';
import { LaravelManagerStorageKeys } from '../persistence/LaravelManagerStorageKeys';
import { apiManager } from '../../../core/integrations/laravel/ApiManager';
import {
  buildApiUrl,
  type BackendApiEndpoint,
} from '../../../core/integrations/laravel/LaravelEndpoints';
import {
  createFixedLaravelModuleConfig,
  LARAVEL_API_PREFIX,
} from '../../../core/integrations/laravel/transport/ApiContract';
import { getSharedAuthToken } from '../../../core/integrations/laravel/transport/BaseAPI';
import { StorageManager } from '../../../core/persistence';

const WORKSPACE_TIMEOUT_MS = 5000;
export const DATA_SYNC_PROTOCOL_VERSION = 3;
export const DATA_SYNC_PROTOCOL_MISMATCH_ERROR = 'DATA_SYNC_PROTOCOL_VERSION_MISMATCH';
export const DATA_SYNC_PEER_UNREACHABLE_ERROR = 'DATA_SYNC_PEER_UNREACHABLE';
export const DATA_SYNC_MAX_MANAGED_ENDPOINTS = 2;
const DATA_SYNC_DEFAULT_PORT = 9000;

export interface DataSyncManagedEndpoint {
  id: string;
  baseUrl: string;
  syncTarget: string;
  description: string;
  healthy: boolean | null;
  responseTime: number | null;
  current: boolean;
  managed: boolean;
  /** Ad-hoc node resolved from a typed address; not part of the endpoint registry. */
  adhoc?: boolean;
}

/** Second user state: an independent login against another Laravel backend. */
export interface DataSyncPeerAuth {
  token: string;
  username: string;
  loggedAt: string;
}

export interface DataSyncDirectionProbe {
  /** push = old server packs and uploads (POST) to the new server; pull = new server downloads from the old server. */
  direction: 'push' | 'pull';
  oldServer: DataSyncManagedEndpoint;
  newServer: DataSyncManagedEndpoint;
  forward: DataSyncProbeResult;
  backward: DataSyncProbeResult | null;
}

export interface ManagedDataSyncSession extends DataSyncSession {
  manager_endpoint: DataSyncManagedEndpoint;
  manager_key: string;
}

export interface DataSyncWorkspaceError {
  endpointId: string;
  message: string;
  /** HTTP status when the failure came from a response (401 = peer login required). */
  status?: number;
}

export interface DataSyncWorkspace {
  endpoints: DataSyncManagedEndpoint[];
  sessions: ManagedDataSyncSession[];
  errors: DataSyncWorkspaceError[];
}

export class DataSyncModel {
  private clients = new Map<string, DatabaseManagerAPI>();
  private adhocEndpoints = new Map<string, DataSyncManagedEndpoint>();

  endpoints(): DataSyncManagedEndpoint[] {
    const currentId = apiManager.getCurrentEndpoint()?.id ?? '';
    const selectedIds = this.managedEndpointIds(currentId);
    const health = new Map(apiManager.getAllHealthResults().map((result) => [result.endpoint.id, result]));

    return apiManager.getAllEndpoints().map((endpoint) => {
      const result = health.get(endpoint.id);
      return {
        id: endpoint.id,
        baseUrl: buildApiUrl(endpoint),
        syncTarget: this.syncTarget(endpoint),
        description: endpoint.description,
        healthy: result ? result.isHealthy : null,
        responseTime: result ? result.responseTime : null,
        current: endpoint.id === currentId,
        managed: selectedIds.includes(endpoint.id),
      };
    });
  }

  setManagedEndpoints(endpointIds: string[]): DataSyncManagedEndpoint[] {
    const availableIds = new Set(apiManager.getAllEndpoints().map((endpoint) => endpoint.id));
    const currentId = apiManager.getCurrentEndpoint()?.id ?? '';
    const selectedIds = Array.from(new Set([currentId, ...endpointIds]))
      .filter((id) => id !== '' && availableIds.has(id))
      .slice(0, DATA_SYNC_MAX_MANAGED_ENDPOINTS);

    StorageManager.set(LaravelManagerStorageKeys.DATA_SYNC_ENDPOINTS, selectedIds);
    return this.endpoints();
  }

  async workspace(): Promise<DataSyncWorkspace> {
    const endpoints = this.endpoints();
    const queryEndpoints = [
      ...endpoints.filter((endpoint) => endpoint.managed),
      ...Array.from(this.adhocEndpoints.values()),
    ];
    const results = await Promise.all(queryEndpoints.map(async (endpoint) => {
      try {
        const sessions = await this.client(endpoint).getDataSyncSessions();
        if (sessions.some((session) => session.protocol_version !== DATA_SYNC_PROTOCOL_VERSION)) {
          throw new Error(DATA_SYNC_PROTOCOL_MISMATCH_ERROR);
        }
        return { endpoint, sessions, error: null };
      } catch (error) {
        return {
          endpoint,
          sessions: [] as DataSyncSession[],
          error,
        };
      }
    }));
    const sessions = results.flatMap(({ endpoint, sessions: endpointSessions }) =>
      endpointSessions.map((session) => ({
        ...session,
        manager_endpoint: endpoint,
        manager_key: `${endpoint.id}:${session.id}`,
      }))
    ).sort((left, right) => right.created_at.localeCompare(left.created_at));
    const errors = results
      .filter((result) => result.error !== null)
      .map((result) => ({
        endpointId: result.endpoint.id,
        message: result.error instanceof Error ? result.error.message : '',
        status: result.error instanceof DataSyncApiError ? result.error.status : undefined,
      }));

    return { endpoints, sessions, errors };
  }

  async start(endpointId: string, payload: DataSyncStartRequest): Promise<ManagedDataSyncSession> {
    const endpoint = this.requireEndpoint(endpointId);
    const session = await this.client(endpoint).startDataSync(payload);
    return this.managedSession(endpoint, session);
  }

  /** Pull mode: the new server downloads packaged data from the old server. */
  async startFetch(endpointId: string, payload: DataSyncStartRequest): Promise<ManagedDataSyncSession> {
    const endpoint = this.requireEndpoint(endpointId);
    const session = await this.client(endpoint).startDataSyncFetch(payload);
    return this.managedSession(endpoint, session);
  }

  /* ------------------------------------------------------------------ *
   * Second user state — an independent login per remote Laravel node.   *
   * ------------------------------------------------------------------ */

  peerAuth(endpointId: string): DataSyncPeerAuth | null {
    return this.peerAuthMap()[endpointId] ?? null;
  }

  async loginPeer(endpointId: string, username: string, password: string): Promise<DataSyncPeerAuth> {
    const endpoint = this.requireEndpoint(endpointId);
    const authClient = new AuthAPI({
      ...createFixedLaravelModuleConfig(LARAVEL_API_PREFIX.common, endpoint.baseUrl, WORKSPACE_TIMEOUT_MS),
      onUnauthorized: () => undefined,
    });
    const response = await authClient.login({ username, password });
    const payload = (response.data as Record<string, any>)?.data ?? response.data;
    const token = typeof payload?.token === 'string' && payload.token !== '' ? payload.token : null;

    if (!response.success || !token) {
      const error = new Error(response.error || 'Login failed') as Error & { errorCode?: string };
      error.errorCode = response.debugInfo?.error_code;
      throw error;
    }

    const auth: DataSyncPeerAuth = {
      token,
      username,
      loggedAt: new Date().toISOString(),
    };
    const map = this.peerAuthMap();
    map[endpoint.id] = auth;
    StorageManager.set(LaravelManagerStorageKeys.DATA_SYNC_PEER_AUTH, map);
    return auth;
  }

  logoutPeer(endpointId: string): void {
    const map = this.peerAuthMap();
    if (!(endpointId in map)) return;
    delete map[endpointId];
    StorageManager.set(LaravelManagerStorageKeys.DATA_SYNC_PEER_AUTH, map);
  }

  /**
   * Resolve the typed new-server address to a managed endpoint when it
   * matches one, otherwise to an ad-hoc node (kept for this browser session
   * so its sessions join the workspace once authenticated).
   */
  resolveNewServer(input: string): DataSyncManagedEndpoint | null {
    const trimmed = input.trim();
    if (trimmed === '') return null;

    const byAddress = this.endpoints().find((endpoint) =>
      endpoint.syncTarget === trimmed || endpoint.baseUrl === trimmed);
    if (byAddress) return byAddress;

    const host = trimmed.replace(/^https?:\/\//i, '').split(/[:/]/)[0]?.toLowerCase() ?? '';
    const byHost = host !== ''
      ? this.endpoints().find((endpoint) => {
        try {
          return new URL(endpoint.baseUrl).hostname.toLowerCase() === host;
        } catch {
          return false;
        }
      }) ?? null
      : null;
    if (byHost) return byHost;

    const baseUrl = this.normalizeAdhocAddress(trimmed);
    if (baseUrl === null) return null;

    const existing = this.adhocEndpoints.get(baseUrl);
    if (existing) return existing;

    const adhoc: DataSyncManagedEndpoint = {
      id: baseUrl,
      baseUrl,
      syncTarget: baseUrl,
      description: baseUrl,
      healthy: null,
      responseTime: null,
      current: false,
      managed: false,
      adhoc: true,
    };
    this.adhocEndpoints.set(baseUrl, adhoc);
    return adhoc;
  }

  /**
   * Mutual reachability negotiation. The old server probes the new server
   * first: when reachable, the new server is the externally reachable node
   * and the old server packs + uploads (push). Otherwise the new server
   * probes back; when it can reach the old server, the old server is the
   * external node and serves its data for download (pull).
   */
  async probeDirection(oldEndpointId: string, newServerInput: string): Promise<DataSyncDirectionProbe> {
    const oldServer = this.requireEndpoint(oldEndpointId);
    const newServer = this.resolveNewServer(newServerInput);
    if (!newServer) {
      throw new Error(DATA_SYNC_PEER_UNREACHABLE_ERROR);
    }

    const forward = await this.client(oldServer)
      .probeDataSyncPeer(newServer.syncTarget)
      .catch((error): DataSyncProbeResult => ({
        target: newServer.syncTarget,
        reachable: false,
        error: error instanceof Error ? error.message : '',
      }));
    if (forward.reachable) {
      return { direction: 'push', oldServer, newServer, forward, backward: null };
    }

    const backward = await this.client(newServer)
      .probeDataSyncPeer(oldServer.syncTarget)
      .catch((error): DataSyncProbeResult => ({
        target: oldServer.syncTarget,
        reachable: false,
        error: error instanceof Error ? error.message : '',
      }));
    if (backward.reachable) {
      return { direction: 'pull', oldServer, newServer, forward, backward };
    }

    throw new Error(DATA_SYNC_PEER_UNREACHABLE_ERROR);
  }

  async refresh(session: ManagedDataSyncSession): Promise<ManagedDataSyncSession> {
    const refreshed = await this.client(session.manager_endpoint).getDataSyncSession(session.id);
    return this.managedSession(session.manager_endpoint, refreshed);
  }

  async setTarget(session: ManagedDataSyncSession, target: string): Promise<ManagedDataSyncSession> {
    const updated = await this.client(session.manager_endpoint).setDataSyncTarget(session.id, target);
    return this.managedSession(session.manager_endpoint, updated);
  }

  async pause(session: ManagedDataSyncSession): Promise<ManagedDataSyncSession> {
    const updated = await this.client(session.manager_endpoint).pauseDataSync(session.id);
    return this.managedSession(session.manager_endpoint, updated);
  }

  async resume(session: ManagedDataSyncSession): Promise<ManagedDataSyncSession> {
    const updated = await this.client(session.manager_endpoint).resumeDataSync(session.id);
    return this.managedSession(session.manager_endpoint, updated);
  }

  private syncTarget(endpoint: BackendApiEndpoint): string {
    const port = endpoint.port ?? (endpoint.protocol === 'https' ? 443 : 80);
    const host = endpoint.url.includes(':') && !endpoint.url.startsWith('[')
      ? `[${endpoint.url}]`
      : endpoint.url;
    return `${endpoint.protocol}://${host}:${port}`;
  }

  private managedEndpointIds(currentId: string): string[] {
    const saved = StorageManager.get<string[]>(LaravelManagerStorageKeys.DATA_SYNC_ENDPOINTS, []);
    return Array.from(new Set([currentId, ...saved]))
      .filter(Boolean)
      .slice(0, DATA_SYNC_MAX_MANAGED_ENDPOINTS);
  }

  private peerAuthMap(): Record<string, DataSyncPeerAuth> {
    const saved = StorageManager.get<Record<string, DataSyncPeerAuth>>(
      LaravelManagerStorageKeys.DATA_SYNC_PEER_AUTH,
      {},
    );
    return saved && typeof saved === 'object' ? { ...saved } : {};
  }

  private authHeaderFor(endpoint: DataSyncManagedEndpoint): string | null {
    const peerAuth = this.peerAuth(endpoint.id);
    if (peerAuth) return `Bearer ${peerAuth.token}`;
    return endpoint.current ? getSharedAuthToken() : null;
  }

  private normalizeAdhocAddress(input: string): string | null {
    const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`;

    try {
      const parsed = new URL(candidate);
      if (parsed.hostname === '' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
        return null;
      }
      const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
      const port = parsed.port !== '' ? Number(parsed.port) : DATA_SYNC_DEFAULT_PORT;
      if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
      const host = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname;
      return `${protocol}://${host}:${port}`;
    } catch {
      return null;
    }
  }

  private requireEndpoint(endpointId: string): DataSyncManagedEndpoint {
    const endpoint = this.endpoints().find((candidate) => candidate.id === endpointId)
      ?? this.adhocEndpoints.get(endpointId);
    if (!endpoint) throw new Error('DATA_SYNC_SOURCE_ENDPOINT_NOT_FOUND');
    return endpoint;
  }

  private client(endpoint: DataSyncManagedEndpoint): DatabaseManagerAPI {
    const cached = this.clients.get(endpoint.id);
    if (cached) return cached;

    const client = new DatabaseManagerAPI({
      ...createFixedLaravelModuleConfig(
        LARAVEL_API_PREFIX.databaseManager,
        endpoint.baseUrl,
        WORKSPACE_TIMEOUT_MS,
      ),
      authToken: () => this.authHeaderFor(endpoint),
      // Remote nodes own a separate login state: their 401s open the
      // endpoint-scoped peer login, never the shared login modal.
      onUnauthorized: endpoint.current ? undefined : () => undefined,
    });
    this.clients.set(endpoint.id, client);
    return client;
  }

  private managedSession(
    endpoint: DataSyncManagedEndpoint,
    session: DataSyncSession,
  ): ManagedDataSyncSession {
    if (session.protocol_version !== DATA_SYNC_PROTOCOL_VERSION) {
      throw new Error(DATA_SYNC_PROTOCOL_MISMATCH_ERROR);
    }

    return {
      ...session,
      manager_endpoint: endpoint,
      manager_key: `${endpoint.id}:${session.id}`,
    };
  }
}

export const dataSyncModel = new DataSyncModel();
