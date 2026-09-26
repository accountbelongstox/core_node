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
export const DATA_SYNC_PROTOCOL_VERSION = 5;
export const DATA_SYNC_PROTOCOL_MISMATCH_ERROR = 'DATA_SYNC_PROTOCOL_VERSION_MISMATCH';
export const DATA_SYNC_PEER_UNREACHABLE_ERROR = 'DATA_SYNC_PEER_UNREACHABLE';
export const DATA_SYNC_MAX_MANAGED_ENDPOINTS = 2;
export const DATA_SYNC_SAME_NODE_ERROR = 'DATA_SYNC_SAME_NODE';
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
  /** Machine code per queried endpoint id (same machine = same code). */
  machineCodes: Record<string, string>;
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
        const workspace = await this.client(endpoint).getDataSyncWorkspace();
        // The node's own protocol decides compatibility; sessions left over
        // from another protocol version are history, not a node failure.
        if ((workspace.protocol_version ?? DATA_SYNC_PROTOCOL_VERSION) !== DATA_SYNC_PROTOCOL_VERSION) {
          throw new Error(DATA_SYNC_PROTOCOL_MISMATCH_ERROR);
        }
        workspace.sessions = workspace.sessions.filter((session) => session.protocol_version === DATA_SYNC_PROTOCOL_VERSION);
        return { endpoint, workspace, error: null };
      } catch (error) {
        return {
          endpoint,
          workspace: { sessions: [] as DataSyncSession[], machine_code: undefined },
          error,
        };
      }
    }));
    const machineCodes: Record<string, string> = {};
    for (const { endpoint, workspace } of results) {
      if (workspace.machine_code) {
        machineCodes[endpoint.id] = workspace.machine_code;
      }
    }
    const merged = results.flatMap(({ endpoint, workspace }) =>
      workspace.sessions.map((session) => ({
        ...session,
        manager_endpoint: endpoint,
        manager_key: `${endpoint.id}:${session.id}`,
      }))
    ).sort((left, right) => right.created_at.localeCompare(left.created_at));

    // The same node can be reachable through several endpoint addresses
    // (loopback, LAN, public domain): its sessions then arrive once per
    // endpoint. Collapse copies of the same session, preferring the current
    // endpoint's copy so actions stay on the local connection.
    const deduped = new Map<string, ManagedDataSyncSession>();
    for (const session of merged) {
      const key = `${session.role}:${session.id}`;
      const existing = deduped.get(key);
      if (!existing || (!existing.manager_endpoint.current && session.manager_endpoint.current)) {
        deduped.set(key, session);
      }
    }
    const sessions = Array.from(deduped.values());
    const errors = results
      .filter((result) => result.error !== null)
      .map((result) => ({
        endpointId: result.endpoint.id,
        message: result.error instanceof Error ? result.error.message : '',
        status: result.error instanceof DataSyncApiError ? result.error.status : undefined,
      }));

    return { endpoints, sessions, machineCodes, errors };
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
   * The old and new servers must be two different machines. Compared by
   * machine code — never by IP: loopback port-forwards and LAN addresses do
   * not identify the answering machine. Falls back to registry identity only
   * when a machine code is not known yet for one side.
   */
  sameNode(first: DataSyncManagedEndpoint, second: DataSyncManagedEndpoint, machineCodes: Record<string, string> = {}): boolean {
    if (first.id === second.id) return true;
    const firstCode = machineCodes[first.id];
    const secondCode = machineCodes[second.id];
    if (firstCode && secondCode) return firstCode === secondCode;
    return false;
  }

  /**
   * Mutual reachability negotiation. A LAN or loopback new-server address is
   * only meaningful from the browser's side (NAT, port forwards), so the old
   * server never probes it: the new server downloads directly from the old
   * server (pull). Public addresses probe forward (push) first, then backward
   * (pull). Same-machine pairs are rejected by machine code.
   */
  async probeDirection(oldEndpointId: string, newServerInput: string): Promise<DataSyncDirectionProbe> {
    const oldServer = this.requireEndpoint(oldEndpointId);
    const newServer = this.resolveNewServer(newServerInput);
    if (!newServer) {
      throw new Error(DATA_SYNC_PEER_UNREACHABLE_ERROR);
    }

    if (this.isPrivateAddress(newServer.syncTarget)) {
      return {
        direction: 'pull',
        oldServer,
        newServer,
        forward: {
          target: newServer.syncTarget,
          reachable: false,
          error: 'LAN address: the old server is not probed; the new server downloads directly.',
        },
        backward: null,
      };
    }

    const forward = await this.client(oldServer)
      .probeDataSyncPeer(newServer.syncTarget)
      .catch((error): DataSyncProbeResult => ({
        target: newServer.syncTarget,
        reachable: false,
        error: error instanceof Error ? error.message : '',
      }));
    if (forward.reachable) {
      if (forward.same_machine === true) {
        throw new Error(DATA_SYNC_SAME_NODE_ERROR);
      }
      if (forward.protocol_compatible === false) {
        throw new Error(DATA_SYNC_PROTOCOL_MISMATCH_ERROR);
      }
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
      if (backward.same_machine === true) {
        throw new Error(DATA_SYNC_SAME_NODE_ERROR);
      }
      if (backward.protocol_compatible === false) {
        throw new Error(DATA_SYNC_PROTOCOL_MISMATCH_ERROR);
      }
      return { direction: 'pull', oldServer, newServer, forward, backward };
    }

    throw new Error(DATA_SYNC_PEER_UNREACHABLE_ERROR);
  }

  /** Loopback, RFC1918, and IPv6 ULA addresses are only LAN-reachable. */
  private isPrivateAddress(address: string): boolean {
    let host: string;
    try {
      host = new URL(address).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    } catch {
      return false;
    }
    if (host === 'localhost' || host === '::1') return true;
    if (/^fc/i.test(host) || /^fd/i.test(host)) return true;
    const parts = host.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    if (parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return parts[0] === 192 && parts[1] === 168;
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

  async cancel(session: ManagedDataSyncSession): Promise<ManagedDataSyncSession> {
    const updated = await this.client(session.manager_endpoint).cancelDataSync(session.id);
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

  /**
   * Mirrors the backend rule: a bare host uses http and the Laravel Main
   * port; an explicit scheme without a port uses that scheme's standard port.
   */
  private normalizeAdhocAddress(input: string): string | null {
    const explicitScheme = /^https?:\/\//i.test(input);
    const candidate = explicitScheme ? input : `http://${input}`;

    try {
      const parsed = new URL(candidate);
      if (parsed.hostname === '' || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
        return null;
      }
      const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
      const port = parsed.port !== ''
        ? Number(parsed.port)
        : (explicitScheme ? (protocol === 'https' ? 443 : 80) : DATA_SYNC_DEFAULT_PORT);
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
