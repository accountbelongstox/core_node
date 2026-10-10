import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import { useRecentCommand, type QuickCommandChoice } from '@/apps/pycore-manager/components/PcTerminalQuickCommands';
import type { TerminalQuickCommandRun } from '@/apps/pycore-manager/api';

export interface QuickCommandRequest extends QuickCommandChoice {
  windowId: string;
  terminalNumber: number;
}

type RunStage = 'running' | 'done' | 'failed';

interface RunState {
  request: QuickCommandRequest;
  stage: RunStage;
  run: TerminalQuickCommandRun | null;
  errorCode: string | null;
}

const STATUS_POLL_MS = 500;
const STATUS_POLL_MAX_FAILURES = 6;
/** The run is bounded by pycore's max wait; this is the extra time the browser waits for its final state. */
const STATUS_POLL_GRACE_MS = 30000;
const ERROR_REQUEST = 'request_failed';
const ERROR_TIMEOUT = 'quick_command_idle_timeout';

interface UseQuickCommandRunOptions {
  /** Called when a started run ends; success means the command was typed and submitted. */
  onFinished: (request: QuickCommandRequest, success: boolean, errorCode: string | null) => void;
  errorTranslationKey: (errorCode?: string | null) => string;
}

/** Quick commands run at once through the library route; progress and the result show as one log line, never a dialog. */
export function useQuickCommandRun({ onFinished, errorTranslationKey }: UseQuickCommandRunOptions) {
  const terminalApi = usePcTerminalApi();
  const [, rememberRecent] = useRecentCommand();
  const [state, setState] = useState<RunState | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  const runningRef = useRef(false);

  const run = useCallback(async (request: QuickCommandRequest) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState({ request, stage: 'running', run: null, errorCode: null });
    try {
      const started = await terminalApi.runTerminalQuickCommand(request.windowId, request.terminalNumber, request.entry.key, request.platform);
      if (!started.success) {
        const errorCode = started.error_code ?? ERROR_REQUEST;
        runningRef.current = false;
        setState({ request, stage: 'failed', run: started, errorCode });
        finishedRef.current(request, false, errorCode);
        return;
      }
      setState({ request, stage: 'running', run: started, errorCode: null });
    } catch {
      runningRef.current = false;
      setState({ request, stage: 'failed', run: null, errorCode: ERROR_REQUEST });
      finishedRef.current(request, false, ERROR_REQUEST);
    }
  }, [terminalApi]);

  const runId = state?.stage === 'running' ? state.run?.run_id : undefined;
  const runRequest = state?.stage === 'running' ? state.request : null;
  useEffect(() => {
    if (!runId || !runRequest) return undefined;
    let cancelled = false;
    let timer = 0;
    let failures = 0;
    const deadline = Date.now() + runRequest.interrupt.max_wait_ms + STATUS_POLL_GRACE_MS;
    const finish = (stage: 'done' | 'failed', result: TerminalQuickCommandRun | null, errorCode: string | null) => {
      runningRef.current = false;
      setState({ request: runRequest, stage, run: result, errorCode });
      if (stage === 'done') rememberRecent(runRequest.entry, runRequest.line);
      finishedRef.current(runRequest, stage === 'done', errorCode);
    };
    const poll = async () => {
      let ended = false;
      try {
        const result = await terminalApi.terminalQuickCommandStatus(runRequest.terminalNumber);
        if (cancelled) return;
        failures = 0;
        if (result.run_id === runId && (result.state === 'done' || result.state === 'failed')) {
          ended = true;
          finish(result.state, result, result.state === 'done' ? null : result.error_code ?? ERROR_REQUEST);
        } else if (result.run_id === runId) {
          setState((current) => (current && current.stage === 'running' ? { ...current, run: result } : current));
        }
      } catch {
        failures += 1;
        if (!cancelled && failures >= STATUS_POLL_MAX_FAILURES) {
          ended = true;
          finish('failed', null, ERROR_REQUEST);
        }
      }
      if (cancelled || ended) return;
      if (Date.now() >= deadline) {
        finish('failed', null, ERROR_TIMEOUT);
        return;
      }
      timer = window.setTimeout(() => { void poll(); }, STATUS_POLL_MS);
    };
    timer = window.setTimeout(() => { void poll(); }, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rememberRecent, runId, runRequest, terminalApi]);

  const logFor = (terminalNumber: number | undefined) => (
    state && state.request.terminalNumber === terminalNumber
      ? <PcTerminalQuickCommandLog state={state} errorTranslationKey={errorTranslationKey} />
      : null
  );
  return { run, logFor, activeTerminalNumber: state?.stage === 'running' ? state.request.terminalNumber : null };
}

interface PcTerminalQuickCommandLogProps {
  state: RunState;
  errorTranslationKey: (errorCode?: string | null) => string;
}

/** One log line: the command, then its phase while running and the result when it ends. */
const PcTerminalQuickCommandLog: React.FC<PcTerminalQuickCommandLogProps> = ({ state, errorTranslationKey }) => {
  const { t } = useTranslation('pc');
  const { request, stage, run, errorCode } = state;
  const phaseText = t(`terminal.commands.quick.phase.${run?.phase ?? 'interrupting'}`, {
    sent: run?.ctrl_c_sent ?? 0,
    count: run?.ctrl_c_count ?? request.interrupt.ctrl_c_count,
  });
  const tone = stage === 'done'
    ? 'text-emerald-600 dark:text-emerald-400'
    : stage === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
  const Icon = stage === 'done' ? CircleCheck : stage === 'failed' ? CircleAlert : Loader2;

  return (
    <p className={`flex min-w-0 items-center gap-1.5 text-[10px] ${tone}`} role={stage === 'failed' ? 'alert' : 'status'}>
      <Icon className={`h-3 w-3 shrink-0 ${stage === 'running' ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="truncate font-mono">{request.line}</span>
      <span className="shrink-0">·</span>
      <span className="min-w-0 truncate">
        {stage === 'done' && t('terminal.commands.quick.done')}
        {stage === 'failed' && t('terminal.commands.quick.failed', { reason: t(errorTranslationKey(errorCode)) })}
        {stage === 'running' && phaseText}
      </span>
    </p>
  );
};
