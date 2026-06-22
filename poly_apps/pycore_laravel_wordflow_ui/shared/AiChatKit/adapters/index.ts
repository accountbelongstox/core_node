/**
 * AiChatKit adapter registry. One adapter per end binds the shared chat UI to
 * that end's existing chat backend. pycore is the default (multi-provider, live
 * via the dev /pyapi proxy); laravel/wordflow are wired in later phases.
 */
import { AiChatAdapter } from '../../../shell/shellTypes';
import { pycoreChatAdapter } from './pycoreChatAdapter';
import { laravelChatAdapter } from './laravelChatAdapter';

export const CHAT_ADAPTERS: AiChatAdapter[] = [
  pycoreChatAdapter,
  laravelChatAdapter,
];

export function getChatAdapter(id: string): AiChatAdapter {
  const found = CHAT_ADAPTERS.find((a) => a.id === id);
  return found ? found : pycoreChatAdapter;
}
