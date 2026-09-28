/**
 * PromptDerivedHost — global subscriber for the pycore Linux prompt-derive
 * push (agent_history.prompt.derived). The event reaches the UI through two
 * transports: direct pycore SSE (local) and the Laravel relay outbox → Mercure
 * hub (remote); the relay frame is bridged onto the same local topic, and a
 * small id-based dedup prevents double toasts when both transports deliver.
 *
 * On each push it immediately prints the "new prompt on Linux (Debian)" line
 * (agent name, original prompt, derived English) into the shared log store and
 * raises a stacked corner toast through the shared notify popup library; the
 * toast copy action copies the derived EN prompt, the panel action opens the
 * global cloud clipboard panel on the Prompts tab.
 *
 * Mounted ONCE in ShellRuntime next to ShellCloudClipboard.
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notify } from '../notify/notify';
import { pycoreEventBus, PYCORE_EVENT_TOPICS } from '../../core/integrations/pycore';
import type { AgentHistoryPromptDerivedItem } from '../../core/integrations/pycore/PycoreSpeechTypes';
import { RELAY_CONTRACT } from '../../core/contracts/RelayContract';
import { laravelRelayOperationEvents } from '../../core/integrations/laravel/LaravelRelayOperationEvents';
import { logInfo } from '../../core/logstore/logStore';
import { useShell } from '../../shell/ShellContext';
import '../cloud-clipboard/CloudClipboardLocales';

const LOG_SOURCE = 'prompt-derived';
const TOAST_DURATION_MS = 9000;
const TOAST_TEXT_CAP = 160;
const DEDUP_WINDOW_MS = 30000;
const DEDUP_MAX_IDS = 50;

const RELAY_PROMPT_DERIVED_EVENT = String(
  (RELAY_CONTRACT.events as Record<string, string>).agent_history_prompt_derived || '',
);

const PromptDerivedHost: React.FC = () => {
  const { setClipboard } = useShell();
  const { t } = useTranslation('cloudClipboard');
  const tRef = React.useRef(t);
  tRef.current = t;
  const recentIds = React.useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const seen = (id: string): boolean => {
      const now = Date.now();
      const map = recentIds.current;
      for (const [key, at] of map) {
        if (now - at > DEDUP_WINDOW_MS) map.delete(key);
      }
      if (map.has(id)) return true;
      map.set(id, now);
      if (map.size > DEDUP_MAX_IDS) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
      return false;
    };

    const handlePayload = (payload: any) => {
      const item = payload?.item as AgentHistoryPromptDerivedItem | undefined;
      if (!item || !item.derived_text) return;
      if (item.id && seen(item.id)) return;
      const tt = tRef.current;
      const title = tt('promptDerivedToastTitle');
      // Required immediate print: title, agent name, original, derived EN.
      logInfo(
        LOG_SOURCE,
        `${title} | ${tt('promptAgent')}=${item.tool || '?'} | `
        + `${tt('promptOriginal')}: ${item.source_text || ''} | `
        + `${tt('promptDerived')}: ${item.derived_text}`,
      );
      notify.info({
        title: `${title} · ${item.tool || '?'}`,
        message: item.derived_text.length > TOAST_TEXT_CAP
          ? `${item.derived_text.slice(0, TOAST_TEXT_CAP)}…`
          : item.derived_text,
        duration: TOAST_DURATION_MS,
        copyText: item.derived_text,
        actions: [{
          label: tt('openPromptPanel'),
          onClick: () => setClipboard({ open: true, collapsed: false, tab: 'prompts' }),
        }],
      });
    };

    const offLocal = pycoreEventBus.subscribe(
      PYCORE_EVENT_TOPICS.agentHistoryPromptDerived,
      handlePayload,
    );
    // Relay mode: pycore forwards prompt.derived through the Laravel relay
    // outbox to the FrankenPHP Mercure hub; bridge it onto the same local topic
    // handler (metadata carries the original pycore payload).
    const offRelay = RELAY_PROMPT_DERIVED_EVENT
      ? laravelRelayOperationEvents.onEvent((event, data) => {
          if (event !== RELAY_PROMPT_DERIVED_EVENT) return;
          const frame = data as { metadata?: unknown } | null;
          handlePayload((frame && typeof frame === 'object' ? frame.metadata : data) ?? {});
        })
      : () => {};
    return () => {
      offLocal();
      offRelay();
    };
  }, [setClipboard]);

  return null;
};

export default PromptDerivedHost;
