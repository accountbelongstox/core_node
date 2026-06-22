/**
 * Shared AiChatKit history helpers — load/save/append per adapter id.
 * Other surfaces (e.g. provider probes) can append temporary log lines that
 * appear the next time the user opens AI Chat.
 */
import type { AiChatMessage } from '../../shell/shellTypes';

export const AICHAT_HISTORY_EVENT = 'aichat-history-updated';

export function historyKey(adapterId: string): string {
  return `aichat_history_${adapterId}`;
}

export function loadHistory(adapterId: string): AiChatMessage[] {
  try {
    const raw = localStorage.getItem(historyKey(adapterId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(adapterId: string, messages: AiChatMessage[]): void {
  try {
    localStorage.setItem(historyKey(adapterId), JSON.stringify(messages.slice(-50)));
  } catch {
    /* ignore quota */
  }
}

export function appendChatMessages(adapterId: string, msgs: AiChatMessage[]): void {
  if (msgs.length === 0) return;
  const next = [...loadHistory(adapterId), ...msgs].slice(-50);
  saveHistory(adapterId, next);
  window.dispatchEvent(new CustomEvent(AICHAT_HISTORY_EVENT, {
    detail: { adapterId, messages: next },
  }));
}
