/**
 * AiChatKit adapter for the pycore-manager end.
 *
 * pycore exposes a multi-provider AI surface: GET /ai/probe lists available
 * providers (+ models), POST /ai/chat runs a chat turn. This adapter delegates
 * to the self-contained PycoreApi library (which reaches the backend through the
 * dev `/pyapi` reverse proxy — see vite.config.ts) and maps the real
 * AiProbeResponse / AiChatResponse shapes to the shared AiChatKit contract.
 */
import { AiChatAdapter, AiChatProvider, AiChatSendResult } from '../../../shell/shellTypes';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { AiChatMessage as PyAiChatMessage } from '../../../core/api-libs/pycore';

export const pycoreChatAdapter: AiChatAdapter = {
  id: 'pycore',
  label: 'Pycore AI',

  async listProviders(): Promise<AiChatProvider[]> {
    const res = await pycoreApi.getAiCatalog();
    const raw = Array.isArray(res?.providers) ? res.providers : [];
    return raw
      .filter((p) => p.configured)
      .map((p) => ({
        id: p.name,
        label: p.name,
        models: p.models?.length ? p.models : undefined,
        available: p.tested ? p.available : undefined,
        probeError: p.tested && !p.available ? (p.error ?? 'unavailable') : undefined,
      }));
  },

  async send(messages, opts): Promise<AiChatSendResult> {
    const provider = opts.provider;
    if (!provider) throw new Error('No pycore AI provider selected');
    const pyMessages: PyAiChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const res = await pycoreApi.aiChat(provider, pyMessages, opts.model);
    if (res?.error) throw new Error(String(res.error));
    if (res && res.success === false) throw new Error('pycore AI chat failed');
    const nickname = res?.nickname || (res?.model ? `${res.provider}/${res.model}` : res?.provider);
    return {
      text: res?.text ?? '',
      meta: {
        provider: res?.provider,
        model: res?.model,
        nickname,
        latency_ms: res?.latency_ms ?? null,
      },
    };
  },
};
