export type AiChatRole = 'system' | 'user' | 'assistant';

/** One backend-facing message in a multi-turn AI request. */
export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

/** Per-kind counters for one provider in the shared AI usage rollup. */
export interface AiUsageKindStat {
  calls: number;
  ok: number;
  failed: number;
}

/** Per-provider usage rollup shared by Laravel and Pycore clients. */
export interface AiUsageProviderStat {
  text?: AiUsageKindStat;
  vision?: AiUsageKindStat;
  probe?: AiUsageKindStat;
  last_ts?: number;
  last_model?: string;
}
