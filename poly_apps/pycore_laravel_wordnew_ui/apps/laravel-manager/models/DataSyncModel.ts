import { api } from '../api';
import type {
  DataSyncSession,
  DataSyncStartRequest,
} from '../api/modules/DatabaseManagerAPI';

export class DataSyncModel {
  async list(): Promise<DataSyncSession[]> {
    return api.databaseManager.getDataSyncSessions();
  }

  async start(payload: DataSyncStartRequest): Promise<DataSyncSession> {
    return api.databaseManager.startDataSync(payload);
  }

  async refresh(id: string): Promise<DataSyncSession> {
    return api.databaseManager.getDataSyncSession(id);
  }

  async setTarget(id: string, target: string): Promise<DataSyncSession> {
    return api.databaseManager.setDataSyncTarget(id, target);
  }

  async pause(id: string): Promise<DataSyncSession> {
    return api.databaseManager.pauseDataSync(id);
  }

  async resume(id: string): Promise<DataSyncSession> {
    return api.databaseManager.resumeDataSync(id);
  }
}

export const dataSyncModel = new DataSyncModel();
