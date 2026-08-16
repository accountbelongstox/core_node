import { DatabaseManagerAPI } from '../api/modules/DatabaseManagerAPI';
import type {
  DataSyncSession,
  DataSyncStartRequest,
} from '../api/modules/DatabaseManagerAPI';
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
import { StorageManager } from '../../../core/persistence';

const WORKSPACE_TIMEOUT_MS = 5000;
export const DATA_SYNC_PROTOCOL_VERSION = 3;
export const DATA_SYNC_PROTOCOL_MISMATCH_ERROR = 'DATA_SYNC_PROTOCOL_VERSION_MISMATCH';

export interface DataSyncManagedEndpoint {
  id: string;
  baseUrl: string;
  syncTarget: string;
  description: string;
  healthy: boolean | null;
  responseTime: number | null;
  current: boolean;
  managed: boolean;
}

export interface ManagedDataSyncSession extends DataSyncSession {
  manager_endpoint: DataSyncManagedEndpoint;
  manager_key: string;
}

export interface DataSyncWorkspaceError {
  endpointId: string;
  message: string;
}

export interface DataSyncWorkspace {
  endpoints: DataSyncManagedEndpoint[];
  sessions: ManagedDataSyncSession[];
  errors: DataSyncWorkspaceError[];
}

export class DataSyncModel {
  private clients = new Map<string, DatabaseManagerAPI>();

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
    const selectedIds = Array.from(new Set([...endpointIds, currentId]))
      .filter((id) => id !== '' && availableIds.has(id));

    StorageManager.set(LaravelManagerStorageKeys.DATA_SYNC_ENDPOINTS, selectedIds);
    return this.endpoints();
  }

  async workspace(): Promise<DataSyncWorkspace> {
    const endpoints = this.endpoints();
    const managedEndpoints = endpoints.filter((endpoint) => endpoint.managed);
    const results = await Promise.all(managedEndpoints.map(async (endpoint) => {
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
          error: error instanceof Error ? error.message : '',
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
      .map((result) => ({ endpointId: result.endpoint.id, message: result.error || '' }));

    return { endpoints, sessions, errors };
  }

  async start(endpointId: string, payload: DataSyncStartRequest): Promise<ManagedDataSyncSession> {
    const endpoint = this.requireEndpoint(endpointId);
    const session = await this.client(endpoint).startDataSync(payload);
    return this.managedSession(endpoint, session);
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
    return Array.from(new Set([...saved, currentId])).filter(Boolean);
  }

  private requireEndpoint(endpointId: string): DataSyncManagedEndpoint {
    const endpoint = this.endpoints().find((candidate) => candidate.id === endpointId);
    if (!endpoint) throw new Error('DATA_SYNC_SOURCE_ENDPOINT_NOT_FOUND');
    return endpoint;
  }

  private client(endpoint: DataSyncManagedEndpoint): DatabaseManagerAPI {
    const cached = this.clients.get(endpoint.id);
    if (cached) return cached;

    const client = new DatabaseManagerAPI(createFixedLaravelModuleConfig(
      LARAVEL_API_PREFIX.databaseManager,
      endpoint.baseUrl,
      WORKSPACE_TIMEOUT_MS,
    ));
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
