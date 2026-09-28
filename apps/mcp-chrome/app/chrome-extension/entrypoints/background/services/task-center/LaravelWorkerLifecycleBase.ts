import {
  WorkerApiClient,
  type Task,
  type WorkerCapability,
  type WorkerPullData,
  type WorkerRegistration,
} from '../../api/WorkerApiClient';

export interface PullAcrossTypesOptions {
  preferRemote?: boolean;
  sliceLimit?: (taskType: string, remaining: number) => number;
  onTypePulled?: (taskType: string, data: WorkerPullData) => void;
}

export abstract class LaravelWorkerLifecycleBase {
  private workerApiClient: WorkerApiClient | null = null;

  protected get workerClient(): WorkerApiClient | null {
    return this.workerApiClient;
  }

  protected connectWorkerApi(apiUrl: string): WorkerApiClient {
    const client = new WorkerApiClient(apiUrl);
    this.workerApiClient = client;
    return client;
  }

  protected replaceWorkerApi(client: WorkerApiClient | null): void {
    this.workerApiClient = client;
  }

  protected registerWorkerPresence(registration: WorkerRegistration) {
    return this.requireWorkerClient().register(registration);
  }

  protected heartbeatWorkerPresence(capabilities?: WorkerCapability[], workerId?: string) {
    return this.requireWorkerClient().heartbeat(workerId, capabilities);
  }

  protected unregisterWorkerPresence(
    workerId: string | null,
    onError?: (error: unknown) => void,
  ): void {
    const client = this.workerApiClient;
    if (!client || !workerId) return;
    void client.unregister(workerId).catch((error) => {
      onError?.(error);
    });
  }

  /**
   * Pull task types in order into one merged pull body. Each type takes only
   * the remaining limit, and a later type's failure keeps the tasks already
   * claimed instead of dropping their leases.
   */
  protected async pullAcrossTaskTypes(
    types: readonly string[],
    limit: number,
    options: PullAcrossTypesOptions = {},
  ) {
    const client = this.workerApiClient;
    const merged: Task[] = [];
    let lastData: WorkerPullData = { count: 0, pending_urgent: 0, pending_fast: 0, tasks: [] };
    let pendingUrgent = 0;
    let pendingFast = 0;
    for (const taskType of types) {
      const remaining = Math.max(0, limit - merged.length);
      if (!client || remaining <= 0) break;
      const sliceLimit = options.sliceLimit?.(taskType, remaining) ?? remaining;
      const resp = await client.pullTasks(taskType, undefined, {
        limit: Math.min(remaining, Math.max(1, sliceLimit)),
        preferRemote: options.preferRemote,
      });
      if (!resp.success || !resp.data) {
        if (merged.length === 0) return resp;
        break;
      }
      lastData = resp.data;
      pendingUrgent += Number(resp.data.pending_urgent || 0);
      pendingFast += Number(resp.data.pending_fast || 0);
      if (Array.isArray(resp.data.tasks)) merged.push(...resp.data.tasks);
      options.onTypePulled?.(taskType, resp.data);
    }
    return {
      success: true,
      message: '',
      data: {
        ...lastData,
        pending_urgent: pendingUrgent,
        pending_fast: pendingFast,
        tasks: merged,
        count: merged.length,
      },
    };
  }

  private requireWorkerClient(): WorkerApiClient {
    if (!this.workerApiClient) {
      throw new Error('Worker client not initialized');
    }
    return this.workerApiClient;
  }
}

export default LaravelWorkerLifecycleBase;
