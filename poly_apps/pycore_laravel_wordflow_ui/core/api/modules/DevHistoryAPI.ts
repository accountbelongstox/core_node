import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AI Dev History API — extracted Claude/Codex/Gemini/Cursor prompt & session
 * history served read-only by the Laravel backend (localhost only).
 * Mounted with prefix '/api/dev-history' in core/api/index.ts.
 */

export interface DevHistorySessionSummary {
  id: string;
  raw_id: string;
  tool: string;
  os_user: string;
  project: string;
  title: string;
  started_at: string;
  ended_at: string;
  started_ts: number;
  prompt_count: number;
  message_count: number;
  has_subagent: boolean;
  models?: string[];
  bytes?: number;
  file?: string;
}

export interface DevHistoryTurn {
  ts: number;
  time: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'system';
  is_subagent: boolean;
  model?: string | null;
  name?: string | null;
  text: string;
}

export interface DevHistorySessionDetail extends DevHistorySessionSummary {
  prompts: Array<{ ts: number; text: string }>;
  turns: DevHistoryTurn[];
}

export interface DevHistoryIndex {
  is_dev_machine: boolean;
  generated_at: string;
  tools: string[];
  users: string[];
  sessions: DevHistorySessionSummary[];
  counts?: Record<string, number>;
}

export interface DevHistoryPrompt {
  tool: string;
  os_user: string;
  project: string;
  session_id: string;
  ts: number;
  time: string;
  text: string;
}

export class DevHistoryAPI extends BaseAPI {
  /** Session summaries + tool/user facets for classification. */
  async getIndex(): Promise<APIResponse<DevHistoryIndex>> {
    return this.get('/index');
  }

  /** Full transcript (prompts + turns, incl. sub-agent) for one session. */
  async getSession(id: string): Promise<APIResponse<DevHistorySessionDetail>> {
    return this.get(`/sessions/${encodeURIComponent(id)}`);
  }

  /** Flat, newest-first prompt list, optionally filtered by tool / user. */
  async getPrompts(params?: { tool?: string; user?: string; limit?: number; offset?: number }):
    Promise<APIResponse<{ items: DevHistoryPrompt[]; total: number }>> {
    return this.get('/prompts', params);
  }

  /** Trigger a fresh extraction (idempotent on the backend). */
  async refresh(): Promise<APIResponse<Record<string, unknown>>> {
    return this.post('/refresh', {});
  }
}
