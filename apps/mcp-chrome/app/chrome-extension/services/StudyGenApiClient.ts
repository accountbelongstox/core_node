/**
 * Laravel study-gen plane client (`/api/app_qy_v1/study-gen/*`).
 *
 * Built on BaseApiClient so study generation shares the timeout / error
 * convention of every other backend client. These routes do NOT use the
 * {success,message,data} envelope, so the raw body is passed through and only
 * transport / HTTP failures throw (ApiError carries the status and body).
 */

import { BaseApiClient, type RequestConfig } from '@/entrypoints/background/api/BaseApiClient';
import { studyGenPath } from '@/utils/api-paths';

export type StudyGenBody = Record<string, any>;

const READ_OPTIONS: Omit<RequestConfig, 'method' | 'body'> = {
  headers: { 'Cache-Control': 'no-cache' },
  retries: 0,
};
const WRITE_OPTIONS: Omit<RequestConfig, 'method'> = { retries: 0 };

export class StudyGenApiClient extends BaseApiClient {
  async listSources(params: Record<string, string | number | undefined>): Promise<StudyGenBody> {
    return this.raw(this.get(studyGenPath('sources'), params, READ_OPTIONS));
  }

  async status(sourceType: string, sourceKey: string): Promise<StudyGenBody> {
    return this.raw(this.get(
      studyGenPath('status'),
      { source_type: sourceType, source_key: sourceKey },
      READ_OPTIONS,
    ));
  }

  async claim(body: StudyGenBody): Promise<StudyGenBody> {
    return this.raw(this.post(studyGenPath('claim'), body, WRITE_OPTIONS));
  }

  async release(body: StudyGenBody): Promise<StudyGenBody> {
    return this.raw(this.post(studyGenPath('release'), body, WRITE_OPTIONS));
  }

  async submit(body: StudyGenBody): Promise<StudyGenBody> {
    return this.raw(this.post(studyGenPath('submit'), body, WRITE_OPTIONS));
  }

  private async raw(request: Promise<unknown>): Promise<StudyGenBody> {
    return ((await request) ?? {}) as StudyGenBody;
  }
}
