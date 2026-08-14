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

export interface AiChatMessageMeta {
  provider?: string;
  model?: string;
  nickname?: string;
  latency_ms?: number | null;
}

export interface AiChatUiMessage extends AiChatMessage {
  meta?: AiChatMessageMeta;
}

export interface AiChatSendResult {
  text: string;
  meta?: AiChatMessageMeta;
}

export interface AiChatProvider {
  id: string;
  label: string;
  models?: string[];
  available?: boolean;
  probeError?: string | null;
}

export interface AiChatSendOptions {
  provider?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface AiChatAdapter {
  id: string;
  label: string;
  listProviders?: () => Promise<AiChatProvider[]>;
  send: (messages: AiChatUiMessage[], options: AiChatSendOptions) => Promise<AiChatSendResult>;
}
