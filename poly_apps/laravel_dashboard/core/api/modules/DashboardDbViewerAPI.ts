import { BaseAPI } from '../base/BaseAPI';

export interface DbViewerTableStructureColumn {
  name: string;
  type: string;
  nullable: string;
  key: string;
  default: string | null;
  extra: string;
}

export interface DbViewerTableDataResponse {
  data: Record<string, unknown>[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export class DashboardDbViewerAPI extends BaseAPI {
  async getTables(): Promise<string[]> {
    const res = await this.get<{ tables: string[] }>('tables');
    if (!res.success || !res.data) return [];
    return (res.data as { tables: string[] }).tables ?? [];
  }

  async getStructure(table: string): Promise<DbViewerTableStructureColumn[]> {
    const res = await this.get<{ columns: DbViewerTableStructureColumn[] }>(
      `tables/${encodeURIComponent(table)}/structure`
    );
    if (!res.success || !res.data) return [];
    return (res.data as { columns: DbViewerTableStructureColumn[] }).columns ?? [];
  }

  async getData(
    table: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<DbViewerTableDataResponse> {
    const res = await this.get<DbViewerTableDataResponse>(
      `tables/${encodeURIComponent(table)}/data`,
      { page, per_page: perPage }
    );
    if (!res.success || !res.data) {
      return { data: [], total: 0, per_page: perPage, current_page: page, last_page: 1 };
    }
    return res.data as DbViewerTableDataResponse;
  }
}
