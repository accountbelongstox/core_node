/**
 * LaravelSdkChatAdapter — AiChatKit adapter for laravel_main's official
 * Laravel AI SDK surface (/api/local/ai/chat/*).
 *
 * Full-capability adapter: server-persisted conversations (sidebar + DB
 * history), image attachments (vision), SDK provider failover ("auto"), and
 * the gateway prompt cache (toggle + cached badge). Transport delegates to
 * the typed AiManagementAPI module; this file only maps shapes.
 */
import type {
  AiChatAdapter,
  AiChatConversationMeta,
  AiChatProvider,
  AiChatSendResult,
  AiChatUiMessage,
} from '@/core/contracts/ai';
import { api } from '../api';

export const laravelSdkChatAdapter: AiChatAdapter = {
  id: 'laravel-sdk',
  label: 'Laravel AI',
  supportsAttachments: true,
  supportsPromptCache: true,

  async listProviders(): Promise<AiChatProvider[]> {
    const res = await api.aiManagement.getCapabilities();
    const providers = res.success && res.data ? res.data.providers : [];
    const chatProviders = providers.filter((p) => p.capabilities.includes('text'));
    return [
      {
        id: 'auto',
        label: 'Auto (SDK failover)',
        available: chatProviders.some((p) => p.chat_enabled) ? undefined : false,
        probeError: chatProviders.some((p) => p.chat_enabled) ? null : 'no configured provider',
      },
      ...chatProviders.map((p) => ({
        id: p.name,
        label: p.name,
        models: p.models?.text ? [p.models.text] : undefined,
        available: p.chat_enabled ? undefined : false,
        probeError: p.chat_enabled ? null : 'no API key configured',
      })),
    ];
  },

  async send(messages, opts): Promise<AiChatSendResult> {
    const last = messages[messages.length - 1];
    const res = await api.aiManagement.sendChatMessage({
      conversation_id: opts.conversationId,
      provider: opts.provider || 'auto',
      model: opts.model || undefined,
      message: last?.content ?? '',
      images: (opts.attachments ?? [])
        .filter((a) => a.data && a.mime)
        .map((a) => ({ name: a.name ?? undefined, mime: String(a.mime), data: String(a.data) })),
      cache: opts.useCache ?? true,
      source: 'ai-chat',
    });
    const d = res.data;
    if (!res.success || !d) throw new Error(res.error || 'Chat request failed');
    if (!d.success) throw new Error(d.error || 'Chat request failed');
    return {
      text: d.text ?? '',
      conversationId: d.conversation_id ?? undefined,
      meta: {
        provider: d.provider,
        model: d.model,
        nickname: d.model ? `${d.provider}/${d.model}` : d.provider,
        latency_ms: d.latency_ms,
        cached: d.cached,
        usage: d.usage,
      },
    };
  },

  async listConversations(): Promise<AiChatConversationMeta[]> {
    const res = await api.aiManagement.listConversations();
    const list = res.success && res.data ? res.data.conversations : [];
    return list.map((c) => ({
      id: c.id,
      title: c.title,
      message_count: c.message_count,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  },

  async loadConversation(id: string): Promise<AiChatUiMessage[]> {
    const res = await api.aiManagement.getConversationMessages(id);
    if (!res.success || !res.data) throw new Error(res.error || 'Failed to load the conversation');
    if (res.data.success === false) throw new Error(res.data.error || 'Failed to load the conversation');
    return (res.data.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      attachments: (m.attachments ?? []).map((a) => ({
        ...a,
        url: a.file ? api.aiManagement.chatAttachmentUrl(a.file) : a.url,
      })),
      meta: {
        provider: m.meta?.provider ?? undefined,
        model: m.meta?.model ?? undefined,
        nickname: m.meta?.provider
          ? (m.meta?.model ? `${m.meta.provider}/${m.meta.model}` : m.meta.provider)
          : undefined,
        cached: m.meta?.cached,
        usage: m.usage,
      },
    }));
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await api.aiManagement.deleteConversation(id);
    if (!res.success || res.data?.success === false) {
      throw new Error(res.data?.error || res.error || 'Failed to delete the conversation');
    }
  },
};
