/**
 * AiChatKit adapter for the wordflow end.
 *
 * Binds the shared chat UI to WordFlow's assistant. The original Capacitor app
 * ran chat client-side via Gemini (services/geminiService.ts); in this shell the
 * assistant routes through the same `/api/app_qy_v1` backend via WordflowApi
 * (probe / auto-select / failover + Bearer auth preserved). Errors surface to
 * the chat UI rather than failing silently.
 */
import { AiChatAdapter, AiChatMessage, AiChatSendResult } from '../../../shell/shellTypes';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

export const wordflowChatAdapter: AiChatAdapter = {
  id: 'wordflow',
  label: 'WordFlow Assistant',
  async send(messages: AiChatMessage[]): Promise<AiChatSendResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUser ? lastUser.content : '';
    if (!prompt.trim()) return { text: '' };

    const history = messages
      .filter((m) => m !== lastUser)
      .map((m) => ({ role: m.role, content: m.content }));

    const reply = await wordflowApi.assistant(prompt, history);
    return { text: reply || 'No response generated.' };
  },
};
