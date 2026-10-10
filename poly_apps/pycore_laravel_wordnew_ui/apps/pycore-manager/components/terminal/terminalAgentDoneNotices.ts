/**
 * AI-agent "finished" notices of every terminal node tab, merged into one list.
 * The shown node feeds its own snapshots; the other online nodes are polled by
 * PcAgentDoneNotices. A notice stays until it is closed, cleared, or the user
 * interacts with the page after it arrived (it then fades out).
 */
import { createPcExternalStore, type TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { PRIMARY_NODE_KEY } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { PcOsKind } from '@/apps/pycore-manager/components/terminal/PcOsIcon';

const MAX_NOTICES = 12;
export const NOTICE_FADE_MS = 2500;

export interface AgentDoneNotice {
  key: string;
  nodeUrl: string | null;
  nodeLabel: string;
  os: PcOsKind;
  terminalNumber: number;
  name: string;
  /** Local epoch ms of the finish. */
  finishedAtMs: number;
  /** Set once the user interacted after the notice arrived; the notice is removed at this time. */
  expiresAt: number | null;
}

export interface AgentDoneSource {
  nodeUrl: string | null;
  nodeLabel: string;
  os: PcOsKind;
  untitled: string;
  /** Machine wall-clock seconds -> local Date. */
  localDate: (serverSeconds: number) => Date;
}

export interface AgentDoneOpenRequest {
  nodeUrl: string | null;
  terminalNumber: number;
}

export function terminalName(windowInfo: TerminalWindowInfo, fallback: string): string {
  return windowInfo.custom_title || windowInfo.short_title || windowInfo.title || windowInfo.app || fallback;
}

const nodeKeyOf = (nodeUrl: string | null) => nodeUrl ?? PRIMARY_NODE_KEY;

export const agentDoneNotices = createPcExternalStore<AgentDoneNotice[]>([]);
/** A clicked notice whose node tab is (re)mounting: the node view opens the terminal once it is listed. */
export const agentDoneOpenRequest = createPcExternalStore<AgentDoneOpenRequest | null>(null);
const seenByNode = new Map<string, Map<number, number>>();

/** Records a node snapshot; a working -> idle transition since the node's previous snapshot becomes a notice (the first snapshot only seeds). */
export function ingestAgentDone(source: AgentDoneSource, windows: TerminalWindowInfo[]): void {
  const nodeKey = nodeKeyOf(source.nodeUrl);
  const finished = new Map<number, number>();
  for (const windowInfo of windows) {
    const finishedAt = windowInfo.online ? windowInfo.agent_activity?.finished_at : null;
    if (typeof finishedAt === 'number') finished.set(windowInfo.terminal_number, finishedAt);
  }
  const seen = seenByNode.get(nodeKey);
  seenByNode.set(nodeKey, finished);
  if (!seen) return;
  const fresh: AgentDoneNotice[] = windows.flatMap((windowInfo) => {
    const finishedAt = finished.get(windowInfo.terminal_number);
    if (finishedAt === undefined || finishedAt <= (seen.get(windowInfo.terminal_number) ?? 0)) return [];
    return [{
      key: `${nodeKey}:${windowInfo.terminal_number}:${finishedAt}`,
      nodeUrl: source.nodeUrl,
      nodeLabel: source.nodeLabel,
      os: source.os,
      terminalNumber: windowInfo.terminal_number,
      name: terminalName(windowInfo, source.untitled),
      finishedAtMs: source.localDate(finishedAt).getTime(),
      expiresAt: null,
    }];
  });
  if (!fresh.length) return;
  agentDoneNotices.set((previous) => [
    ...fresh.filter((notice) => !previous.some((item) => item.key === notice.key)),
    ...previous,
  ].slice(0, MAX_NOTICES));
}

export function dismissAgentDoneNotice(key: string): void {
  agentDoneNotices.set((previous) => previous.filter((notice) => notice.key !== key));
}

export function clearAgentDoneNotices(): void {
  agentDoneNotices.set([]);
}

/** A user interaction: every notice that arrived before it fades out after NOTICE_FADE_MS. Returns whether any notice started fading. */
export function expireAgentDoneNoticesAfterInteraction(now: number): boolean {
  if (!agentDoneNotices.get().some((notice) => notice.expiresAt === null)) return false;
  agentDoneNotices.set((previous) => previous.map((notice) => (
    notice.expiresAt === null ? { ...notice, expiresAt: now + NOTICE_FADE_MS } : notice
  )));
  return true;
}

export function pruneExpiredAgentDoneNotices(now: number): void {
  if (!agentDoneNotices.get().some((notice) => notice.expiresAt !== null && notice.expiresAt <= now)) return;
  agentDoneNotices.set((previous) => previous.filter((notice) => notice.expiresAt === null || notice.expiresAt > now));
}
