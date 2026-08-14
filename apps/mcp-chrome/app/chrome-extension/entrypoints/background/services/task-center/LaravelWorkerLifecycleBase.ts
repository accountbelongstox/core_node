import {
  WorkerApiClient,
  type WorkerCapability,
  type WorkerRegistration,
} from '../../api/WorkerApiClient';

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

  private requireWorkerClient(): WorkerApiClient {
    if (!this.workerApiClient) {
      throw new Error('Worker client not initialized');
    }
    return this.workerApiClient;
  }
}

export default LaravelWorkerLifecycleBase;
