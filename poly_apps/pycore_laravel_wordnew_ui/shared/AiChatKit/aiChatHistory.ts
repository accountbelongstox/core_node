/**
 * Shared AiChatKit history helpers — load/save/append per adapter id.
 * Other surfaces (e.g. provider probes) can append temporary log lines that
 * appear the next time the user opens AI Chat.
 */
import type { AiChatUiMessage } from '../../core/contracts/ai';
import { registerLocalDataGroup } from '../../core/persistence/LocalDataRegistry';

export const AICHAT_HISTORY_EVENT = 'aichat-history-updated';

const HISTORY_KEY_PREFIX = 'aichat_history_';

export function historyKey(adapterId: string): string {
  return `${HISTORY_KEY_PREFIX}${adapterId}`;
}

registerLocalDataGroup({
  id: 'shared.ai_chat_history',
  appId: 'shared',
  labelKey: 'common.local_data.groups.ai_chat_history',
  descriptionKey: 'common.local_data.groups.ai_chat_history_desc',
  clearable: true,
  sources: [{ kind: 'localStorage', prefixes: [HISTORY_KEY_PREFIX] }],
});

export function loadHistory(adapterId: string): AiChatUiMessage[] {
  try {
    const raw = localStorage.getItem(historyKey(adapterId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(adapterId: string, messages: AiChatUiMessage[]): void {
  try {
    localStorage.setItem(historyKey(adapterId), JSON.stringify(messages.slice(-50)));
  } catch {
    /* ignore quota */
  }
}

export function appendChatMessages(adapterId: string, msgs: AiChatUiMessage[]): void {
  if (msgs.length === 0) return;
  const next = [...loadHistory(adapterId), ...msgs].slice(-50);
  saveHistory(adapterId, next);
  window.dispatchEvent(new CustomEvent(AICHAT_HISTORY_EVENT, {
    detail: { adapterId, messages: next },
  }));
}
