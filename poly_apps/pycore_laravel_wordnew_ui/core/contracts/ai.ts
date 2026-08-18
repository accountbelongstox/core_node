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

/** Token usage of one AI turn (snake_case, as the gateways report it). */
export interface AiChatUsageTokens {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  /** Tokens served from the provider-side prompt cache (e.g. Anthropic). */
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
}

/**
 * One image attached to a chat message. Upload direction carries `data`
 * (base64, no data: prefix) plus a local preview `url` (data: URL); the
 * server-side direction carries `file` (stored basename) / `url` instead.
 */
export interface AiChatAttachmentRef {
  type?: string;
  name?: string | null;
  mime?: string | null;
  data?: string;
  file?: string | null;
  url?: string | null;
}

export interface AiChatMessageMeta {
  provider?: string;
  model?: string;
  nickname?: string;
  latency_ms?: number | null;
  /** True when the turn was answered from the gateway prompt cache. */
  cached?: boolean;
  usage?: AiChatUsageTokens | null;
}

export interface AiChatUiMessage extends AiChatMessage {
  meta?: AiChatMessageMeta;
  attachments?: AiChatAttachmentRef[];
}

export interface AiChatSendResult {
  text: string;
  meta?: AiChatMessageMeta;
  /**
   * Server-conversation adapters: the conversation this turn belongs to (set
   * on the first turn of a freshly created conversation).
   */
  conversationId?: string;
}

export interface AiChatProvider {
  id: string;
  label: string;
  models?: string[];
  available?: boolean;
  probeError?: string | null;
}

/** One server-persisted chat conversation (sidebar row). */
export interface AiChatConversationMeta {
  id: string;
  title: string;
  message_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AiChatSendOptions {
  provider?: string;
  model?: string;
  signal?: AbortSignal;
  /** Images attached to the outgoing user message (vision-capable adapters). */
  attachments?: AiChatAttachmentRef[];
  /** Gateway prompt-cache toggle (adapters with supportsPromptCache). */
  useCache?: boolean;
  /** Server-conversation adapters: the conversation to continue. */
  conversationId?: string;
}

export interface AiChatAdapter {
  id: string;
  label: string;
  listProviders?: () => Promise<AiChatProvider[]>;
  send: (messages: AiChatUiMessage[], options: AiChatSendOptions) => Promise<AiChatSendResult>;
  /** Advertises image attachments — the kit renders attach/paste controls. */
  supportsAttachments?: boolean;
  /** Advertises a gateway prompt cache — the kit renders the cache toggle. */
  supportsPromptCache?: boolean;
  /**
   * Server-side conversation persistence. When all three are present the kit
   * runs in server-conversation mode (sidebar + DB history) instead of its
   * localStorage history.
   */
  listConversations?: () => Promise<AiChatConversationMeta[]>;
  loadConversation?: (id: string) => Promise<AiChatUiMessage[]>;
  deleteConversation?: (id: string) => Promise<void>;
}
