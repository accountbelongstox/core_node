/**
 * Backup-scheduler watch state of one pycore node (special terminal states, next
 * pass, keyboard idle), polled once and shared by every terminal mark and panel.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { TerminalSpecialEntry } from '@/apps/pycore-manager/api';

const POLL_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 1000;
const MS_PER_SECOND = 1000;

export const STATE_PROMPT_WAITING = 'prompt_waiting';
export const STATE_PROMPT_FOLLOW_UP = 'prompt_follow_up';
export const STATE_RESUME_PENDING = 'resume_pending';

interface WatchSnapshot {
  entries: TerminalSpecialEntry[];
  clockOffset: number;
  idleSeconds: number | null;
  minIdleSeconds: number;
  promptIdleSeconds: number;
  nextPassAt: number | null;
  passPausedRemaining: number;
  paused: boolean;
  running: boolean;
  receivedAt: number;
}

export interface PcTerminalWatch {
  entries: TerminalSpecialEntry[];
  /** Entries of one terminal number. */
  entriesFor: (terminalNumber: number) => TerminalSpecialEntry[];
  /** Pycore wall-clock seconds now (client clock-skew corrected). */
  serverNow: number;
  /** Keyboard idle seconds now; null when the node cannot tell. */
  idleNow: number | null;
  minIdleSeconds: number;
  promptIdleSeconds: number;
  /** Pycore wall-clock seconds of the next interval pass; null before the first pass or when stopped. */
  nextPassAt: number | null;
  /** Terminals left in a pass paused by input (0: none). */
  passPausedRemaining: number;
  available: boolean;
}

const EMPTY_WATCH: PcTerminalWatch = {
  entries: [],
  entriesFor: () => [],
  serverNow: Date.now() / MS_PER_SECOND,
  idleNow: null,
  minIdleSeconds: 0,
  promptIdleSeconds: 0,
  nextPassAt: null,
  passPausedRemaining: 0,
  available: false,
};

const PcTerminalWatchContext = createContext<PcTerminalWatch>(EMPTY_WATCH);

export const PcTerminalWatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const terminalApi = usePcTerminalApi();
  const [snapshot, setSnapshot] = useState<WatchSnapshot | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const aliveRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const result = await terminalApi.terminalBackupState();
      if (!aliveRef.current) return;
      if (!result.success) {
        setSnapshot(null);
        return;
      }
      const receivedAt = Date.now();
      const serverTime = Number(result.server_time);
      const idle = result.idle_seconds;
      const interval = Number(result.interval_seconds) || 0;
      const lastPass = typeof result.last_pass_at === 'number' ? result.last_pass_at : null;
      setSnapshot({
        entries: Array.isArray(result.special_terminals) ? result.special_terminals : [],
        clockOffset: Number.isFinite(serverTime) ? serverTime - receivedAt / MS_PER_SECOND : 0,
        idleSeconds: typeof idle === 'number' && Number.isFinite(idle) ? idle : null,
        minIdleSeconds: Number(result.min_idle_seconds) || 0,
        promptIdleSeconds: Number(result.prompt_idle_seconds) || 0,
        nextPassAt: lastPass !== null && interval > 0 ? lastPass + interval : null,
        passPausedRemaining: Number(result.pass_paused_remaining) || 0,
        paused: Boolean(result.paused),
        running: Boolean(result.running),
        receivedAt,
      });
      setNowMs(receivedAt);
    } catch {
      if (aliveRef.current) setSnapshot(null);
    }
  }, [terminalApi]);

  useEffect(() => {
    aliveRef.current = true;
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [poll]);

  const ticking = Boolean(snapshot && (snapshot.running || snapshot.entries.length));
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const value = useMemo<PcTerminalWatch>(() => {
    if (!snapshot) return { ...EMPTY_WATCH, serverNow: nowMs / MS_PER_SECOND };
    const byNumber = new Map<number, TerminalSpecialEntry[]>();
    for (const entry of snapshot.entries) {
      byNumber.set(entry.number, [...(byNumber.get(entry.number) ?? []), entry]);
    }
    const elapsed = Math.max(0, (nowMs - snapshot.receivedAt) / MS_PER_SECOND);
    return {
      entries: snapshot.entries,
      entriesFor: (terminalNumber) => byNumber.get(terminalNumber) ?? [],
      serverNow: nowMs / MS_PER_SECOND + snapshot.clockOffset,
      idleNow: snapshot.idleSeconds === null ? null : snapshot.idleSeconds + elapsed,
      minIdleSeconds: snapshot.minIdleSeconds,
      promptIdleSeconds: snapshot.promptIdleSeconds,
      nextPassAt: snapshot.running && !snapshot.paused ? snapshot.nextPassAt : null,
      passPausedRemaining: snapshot.passPausedRemaining,
      available: true,
    };
  }, [snapshot, nowMs]);

  return <PcTerminalWatchContext.Provider value={value}>{children}</PcTerminalWatchContext.Provider>;
};

export function usePcTerminalWatch(): PcTerminalWatch {
  return useContext(PcTerminalWatchContext);
}
