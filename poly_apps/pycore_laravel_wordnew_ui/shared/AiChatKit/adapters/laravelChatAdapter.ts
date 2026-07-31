/**
 * AiChatKit adapter for the laravel-manager end.
 *
 * Placeholder: the Laravel app_qy_v1 chat endpoint is wired in a later phase
 * (P4). Until then this surfaces a clear message rather than failing silently.
 * The Laravel Manager application boundary provides the transport.
 */
import { AiChatAdapter } from '../../../shell/shellTypes';

export const laravelChatAdapter: AiChatAdapter = {
  id: 'laravel',
  label: 'Laravel AI',
  async send() {
    throw new Error('Laravel chat endpoint is not wired yet (planned for a later phase).');
  },
};
