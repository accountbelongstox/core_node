/**
 * Shared live feed for every agent-history prompt view: push-driven refresh on
 * the prompt topics (direct socket/SSE and the relay tunnel all feed the bus)
 * plus the reference-counted live-monitor presence lease.
 */
import { useEffect } from 'react';
import { PYCORE_EVENT_TOPICS } from './PycoreEventTopics';
import { PYCORE_PRESENCE_LEASES } from './PycoreNetwork';
import { holdPycoreLease } from './PycoreHttp';
import { usePycoreTopicRefresh } from './usePycoreTopicRefresh';

export const AGENT_HISTORY_FEED_TOPICS: readonly string[] = [
  PYCORE_EVENT_TOPICS.agentHistorySessionsChanged,
  PYCORE_EVENT_TOPICS.agentHistoryPromptNew,
];

export interface AgentHistoryPromptFeedOptions {
  /** Refresh on pushes (the lease is independent of this switch). */
  enabled?: boolean;
  /** Hold the live-monitor presence lease (config live_prompt_monitor is ON). */
  liveMonitor?: boolean;
  topics?: readonly string[];
}

export function useAgentHistoryPromptFeed(
  refresh: () => void | Promise<void>,
  {
    enabled = true,
    liveMonitor = false,
    topics = AGENT_HISTORY_FEED_TOPICS,
  }: AgentHistoryPromptFeedOptions = {},
): void {
  usePycoreTopicRefresh([...topics], refresh, { enabled });
  useEffect(
    () => (liveMonitor ? holdPycoreLease(PYCORE_PRESENCE_LEASES.agentHistoryLiveMonitor) : undefined),
    [liveMonitor],
  );
}
