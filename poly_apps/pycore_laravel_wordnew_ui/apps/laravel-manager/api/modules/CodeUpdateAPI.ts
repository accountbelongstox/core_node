import { BaseAPI } from '../../../../core/api-libs/laravel/transport/BaseAPI';

export interface CodeLastModifiedStatus {
  last_modified_at: string | null;
  last_modified_unix: number | null;
  latest_file: string | null;
  scanned_at: string;
  scan_ms: number;
  method: string;
}

/**
 * Open dashboard probe for laravel_main source freshness (TopHeader poll).
 */
export class CodeUpdateAPI extends BaseAPI {
  async getLastModified(): Promise<CodeLastModifiedStatus | null> {
    const res = await this.get<CodeLastModifiedStatus>(
      'code-last-modified',
      undefined,
      false,
      0,
      false
    );
    if (!res.success || !res.data) return null;
    return res.data as CodeLastModifiedStatus;
  }
}
