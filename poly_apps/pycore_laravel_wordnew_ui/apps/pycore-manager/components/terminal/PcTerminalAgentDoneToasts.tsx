import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleCheck, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getBrowserId, pycoreNodeClient } from '@/apps/pycore-manager/api';
import { PcOsIcon } from '@/apps/pycore-manager/components/terminal/PcOsIcon';
import { listTerminalTabNodes } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import {
  NOTICE_FADE_MS,
  agentDoneNotices,
  agentDoneOpenRequest,
  clearAgentDoneNotices,
  dismissAgentDoneNotice,
  expireAgentDoneNoticesAfterInteraction,
  ingestAgentDone,
  pruneExpiredAgentDoneNotices,
} from '@/apps/pycore-manager/components/terminal/terminalAgentDoneNotices';

/** Nodes that are not shown have no event stream here: they are polled this often. */
const OTHER_NODE_POLL_MS = 10_000;
const VIEWER_SUFFIX = ':agent-done';
/** Gap from the bottom of the main column: the debug dock button (bottom-3, h-11) plus a margin. */
const DOCK_CLEARANCE_PX = 64;
const SIDE_GAP_PX = 12;
const TOP_GAP_PX = 72;
const USER_INPUT_EVENTS = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;

interface PcTerminalAgentDoneToastsProps {
  /** Backend URL of the shown node tab; null is this machine. */
  activeUrl: string | null;
  onSelectNode: (url: string | null) => void;
}

function clockText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Polls every online node tab except the shown one and feeds its snapshots into the shared notices. */
function useOtherNodeAgentDone(activeUrl: string | null): void {
  const { t } = useTranslation('pc');
  const activeUrlRef = useRef(activeUrl);
  activeUrlRef.current = activeUrl;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const viewerId = `${getBrowserId()}${VIEWER_SUFFIX}`;
    let stopped = false;
    const poll = () => {
      const translate = tRef.current;
      for (const node of listTerminalTabNodes(activeUrlRef.current, translate('terminal.nodes.thisMachine'))) {
        if (node.url === activeUrlRef.current) continue;
        void pycoreNodeClient(node.url).terminal.getTerminalWindows(viewerId, []).then((snapshot) => {
          if (stopped || node.url === activeUrlRef.current) return;
          ingestAgentDone({
            nodeUrl: node.url,
            nodeLabel: node.label,
            os: node.os,
            untitled: translate('terminal.untitled'),
            localDate: (serverSeconds) => new Date(serverSeconds * 1000),
          }, snapshot.windows);
        }, () => undefined);
      }
    };
    poll();
    const timer = window.setInterval(poll, OTHER_NODE_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);
}

/** Fixed box aligned to the main column's bottom-left corner, above the debug dock button. */
function useMainColumnAnchor(ref: React.RefObject<HTMLDivElement>, active: boolean): React.CSSProperties {
  const [anchor, setAnchor] = useState<React.CSSProperties>({ left: SIDE_GAP_PX, bottom: DOCK_CLEARANCE_PX });
  useLayoutEffect(() => {
    if (!active) return undefined;
    const main = ref.current?.closest('main');
    if (!main) return undefined;
    const measure = () => {
      const rect = main.getBoundingClientRect();
      setAnchor({
        left: rect.left + SIDE_GAP_PX,
        bottom: window.innerHeight - rect.bottom + DOCK_CLEARANCE_PX,
        maxWidth: Math.max(0, rect.width - SIDE_GAP_PX * 2),
        maxHeight: Math.max(0, rect.height - TOP_GAP_PX - DOCK_CLEARANCE_PX),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref, active]);
  return anchor;
}

/**
 * AI-agent "finished" notices of every node tab in one bottom-left stack: OS icon, computer name,
 * terminal and finish time. Clicking a notice opens that terminal on its tab and keeps every notice;
 * the first user interaction elsewhere fades out the notices that were already shown.
 */
export const PcTerminalAgentDoneToasts: React.FC<PcTerminalAgentDoneToastsProps> = ({ activeUrl, onSelectNode }) => {
  const { t } = useTranslation('pc');
  const notices = agentDoneNotices.use();
  const stackRef = useRef<HTMLDivElement>(null);
  const hasNotices = notices.length > 0;
  const anchor = useMainColumnAnchor(stackRef, hasNotices);
  useOtherNodeAgentDone(activeUrl);

  useEffect(() => {
    if (!hasNotices) return undefined;
    const onInput = (event: Event) => {
      if (event.target instanceof Node && stackRef.current?.contains(event.target)) return;
      if (!expireAgentDoneNoticesAfterInteraction(Date.now())) return;
      window.setTimeout(() => pruneExpiredAgentDoneNotices(Date.now()), NOTICE_FADE_MS);
    };
    for (const name of USER_INPUT_EVENTS) window.addEventListener(name, onInput, { capture: true, passive: true });
    return () => {
      for (const name of USER_INPUT_EVENTS) window.removeEventListener(name, onInput, { capture: true });
    };
  }, [hasNotices]);

  const open = (nodeUrl: string | null, terminalNumber: number) => {
    agentDoneOpenRequest.set({ nodeUrl, terminalNumber });
    if (nodeUrl !== activeUrl) onSelectNode(nodeUrl);
  };

  return (
    <div
      ref={stackRef}
      style={anchor}
      className={`pointer-events-none fixed z-50 flex w-80 flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${hasNotices ? '' : 'hidden'}`}
    >
      {notices.length > 1 && (
        <div className="pointer-events-none sticky top-0 z-10 flex justify-start">
          <button
            type="button"
            onClick={clearAgentDoneNotices}
            className="pc-overlay pointer-events-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-lg shadow-black/20 transition hover:text-rose-500 dark:text-slate-300"
          >
            <XCircle className="h-3.5 w-3.5" />
            {t('terminal.marks.doneToastClearAll')}
          </button>
        </div>
      )}
      {notices.map((notice) => (
        <div
          key={notice.key}
          style={{
            opacity: notice.expiresAt === null ? 1 : 0,
            transition: notice.expiresAt === null ? undefined : `opacity ${NOTICE_FADE_MS}ms linear`,
          }}
          className="pc-overlay pointer-events-auto flex shrink-0 items-start gap-2 rounded-xl border-emerald-400/40 px-3 py-2 shadow-lg shadow-black/20"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <button
            type="button"
            onClick={() => open(notice.nodeUrl, notice.terminalNumber)}
            className="min-w-0 flex-1 text-left text-xs"
          >
            <p className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-300">
              <span className="truncate">{t('terminal.marks.doneToastTitle')}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] font-normal text-slate-500 dark:text-slate-400">
                {clockText(notice.finishedAtMs)}
              </span>
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <PcOsIcon os={notice.os} className="h-3 w-3" />
              <span className="truncate">{notice.nodeLabel}</span>
            </p>
            <p className="truncate text-slate-700 dark:text-slate-200">
              {t('terminal.marks.doneToastBody', { number: notice.terminalNumber, name: notice.name })}
            </p>
          </button>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => dismissAgentDoneNotice(notice.key)}
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default PcTerminalAgentDoneToasts;
