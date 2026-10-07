import { useCallback, useState } from 'react';

import type { TerminalAiAgent, TerminalWindowInfo } from '@/apps/pycore-manager/api';
import {
  STATE_PROMPT_WAITING,
  STATE_RESUME_PENDING,
  type PcTerminalWatch,
} from '@/apps/pycore-manager/components/terminal/PcTerminalWatchContext';
import { PycoreManagerStorageKeys as StorageKeys } from '@/apps/pycore-manager/persistence/PycoreManagerStorageKeys';
import { StorageManager } from '../../../../core/persistence';

export const DISPATCH_AGENT_KINDS = ['claude', 'gemini', 'kimi', 'codex', 'any'] as const;
export type DispatchAgentKind = typeof DISPATCH_AGENT_KINDS[number];
export type TerminalAgentKind = Exclude<DispatchAgentKind, 'any'>;

export const DEFAULT_DISPATCH_AGENT: DispatchAgentKind = 'claude';
/** A terminal that just received a dispatched message stays out of the pool until its busy state shows up in a snapshot. */
export const DISPATCH_COOLDOWN_MS = 20_000;

const CLAUDE_TITLE_GLYPHS = /[✳◐◑◒◓]/;
const BRAILLE_TITLE_GLYPH = /[⠁-⣿]/;
const NAMED_AGENTS: Array<[TerminalAgentKind, RegExp]> = [
  ['claude', /claude/i],
  ['gemini', /gemini/i],
  ['kimi', /kimi/i],
  ['codex', /codex/i],
];
const RULE_AGENT_KINDS: Record<string, TerminalAgentKind> = {
  boxed_input: 'kimi',
  prompt_footer: 'codex',
};

function titleOf(windowInfo: TerminalWindowInfo): string {
  return [windowInfo.title, windowInfo.short_title, windowInfo.custom_title].filter(Boolean).join(' ');
}

function agentKindOf(agent: TerminalAiAgent, title: string): TerminalAgentKind {
  const named = NAMED_AGENTS.find(([, pattern]) => pattern.test(title));
  if (named) return named[0];
  if (CLAUDE_TITLE_GLYPHS.test(title)) return 'claude';
  if (BRAILLE_TITLE_GLYPH.test(title)) return 'codex';
  return RULE_AGENT_KINDS[agent.rule] ?? 'claude';
}

/** Which agent runs in the terminal: the detector's rule plus the window title; null when no agent was recognized. */
export function terminalAgentKind(windowInfo: TerminalWindowInfo): TerminalAgentKind | null {
  return windowInfo.ai_agent ? agentKindOf(windowInfo.ai_agent, titleOf(windowInfo)) : null;
}

/** True for an online agent terminal that finished its task and is not waiting on a confirmation or a usage-limit reset. */
export function isIdleAgentTerminal(windowInfo: TerminalWindowInfo, watch: PcTerminalWatch): boolean {
  if (!windowInfo.online || windowInfo.controllable === false) return false;
  if (!windowInfo.ai_agent || !windowInfo.agent_activity || windowInfo.agent_activity.busy) return false;
  return !watch.entriesFor(windowInfo.terminal_number).some(
    (entry) => entry.state === STATE_PROMPT_WAITING || entry.state === STATE_RESUME_PENDING,
  );
}

interface PickIdleAgentOptions {
  windows: TerminalWindowInfo[];
  excludeTerminalNumber: number;
  agent: DispatchAgentKind;
  watch: PcTerminalWatch;
  /** Terminal number -> time of the last dispatch to it. */
  recentDispatches: ReadonlyMap<number, number>;
  now: number;
}

/** The idle terminal of the chosen agent that has been idle the longest, never the source terminal. */
export function pickIdleAgentTerminal(options: PickIdleAgentOptions): TerminalWindowInfo | null {
  const { windows, excludeTerminalNumber, agent, watch, recentDispatches, now } = options;
  const finishedAt = (windowInfo: TerminalWindowInfo) => windowInfo.agent_activity?.finished_at ?? -Infinity;
  const candidates = windows.filter((windowInfo) => (
    windowInfo.terminal_number !== excludeTerminalNumber
    && isIdleAgentTerminal(windowInfo, watch)
    && (agent === 'any' || terminalAgentKind(windowInfo) === agent)
    && now - (recentDispatches.get(windowInfo.terminal_number) ?? -Infinity) >= DISPATCH_COOLDOWN_MS
  ));
  return candidates.sort((left, right) => finishedAt(left) - finishedAt(right))[0] ?? null;
}

export interface TerminalDispatchSetting {
  enabled: boolean;
  agent: DispatchAgentKind;
  setEnabled: (enabled: boolean) => void;
  setAgent: (agent: DispatchAgentKind) => void;
}

function readAgent(): DispatchAgentKind {
  const stored = StorageManager.get<string>(StorageKeys.PYCORE_TERMINAL_DISPATCH_AGENT, DEFAULT_DISPATCH_AGENT);
  return (DISPATCH_AGENT_KINDS as readonly string[]).includes(stored) ? stored as DispatchAgentKind : DEFAULT_DISPATCH_AGENT;
}

/** Composer setting "send to an idle other agent": persisted with the synced UI settings. */
export function useTerminalDispatchSetting(): TerminalDispatchSetting {
  const [enabled, setEnabledState] = useState<boolean>(
    () => StorageManager.get<boolean>(StorageKeys.PYCORE_TERMINAL_DISPATCH_ENABLED, false) === true,
  );
  const [agent, setAgentState] = useState<DispatchAgentKind>(readAgent);
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    StorageManager.set(StorageKeys.PYCORE_TERMINAL_DISPATCH_ENABLED, value);
  }, []);
  const setAgent = useCallback((value: DispatchAgentKind) => {
    setAgentState(value);
    StorageManager.set(StorageKeys.PYCORE_TERMINAL_DISPATCH_AGENT, value);
  }, []);
  return { enabled, agent, setEnabled, setAgent };
}
