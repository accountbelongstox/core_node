import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Loader2, SquareTerminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePcTerminalApi } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import { useRecentCommand, type QuickCommandChoice } from '@/apps/pycore-manager/components/PcTerminalQuickCommands';
import type { TerminalQuickCommandRun } from '@/apps/pycore-manager/api';

export interface QuickCommandRequest extends QuickCommandChoice {
  windowId: string;
  terminalNumber: number;
}

type RunStage = 'confirm' | 'running' | 'done' | 'failed';

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
const DONE_CLOSE_MS = 1500;
const CONFIRM_KEYS = ['y'];
const CANCEL_KEYS = ['n', 'escape'];
const ERROR_REQUEST = 'request_failed';
const ERROR_TIMEOUT = 'quick_command_idle_timeout';

interface UseQuickCommandRunOptions {
  /** Called when a started run ends; success means the command was typed and submitted. */
  onFinished: (request: QuickCommandRequest, success: boolean) => void;
  errorTranslationKey: (errorCode?: string | null) => string;
}

/** Quick commands only run through the library route, after a y/n confirmation; the dialog follows the run to its end. */
export function useQuickCommandRun({ onFinished, errorTranslationKey }: UseQuickCommandRunOptions) {
  const terminalApi = usePcTerminalApi();
  const [, rememberRecent] = useRecentCommand();
  const [state, setState] = useState<RunState | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const ask = useCallback((request: QuickCommandRequest) => {
    setState((current) => (current && current.stage === 'running' ? current : { request, stage: 'confirm', run: null, errorCode: null }));
  }, []);

  const cancel = useCallback(() => {
    setState((current) => (current && current.stage === 'confirm' ? null : current));
  }, []);

  const hide = useCallback(() => setState(null), []);

  const confirm = useCallback(async () => {
    const current = state;
    if (!current || current.stage !== 'confirm') return;
    const { request } = current;
    setState({ ...current, stage: 'running', run: null, errorCode: null });
    try {
      const started = await terminalApi.runTerminalQuickCommand(request.windowId, request.terminalNumber, request.entry.key, request.platform);
      if (!started.success) {
        setState({ request, stage: 'failed', run: started, errorCode: started.error_code ?? ERROR_REQUEST });
        finishedRef.current(request, false);
        return;
      }
      setState({ request, stage: 'running', run: started, errorCode: null });
    } catch {
      setState({ request, stage: 'failed', run: null, errorCode: ERROR_REQUEST });
      finishedRef.current(request, false);
    }
  }, [state, terminalApi]);

  const runId = state?.stage === 'running' ? state.run?.run_id : undefined;
  const runRequest = state?.stage === 'running' ? state.request : null;
  useEffect(() => {
    if (!runId || !runRequest) return undefined;
    let cancelled = false;
    let timer = 0;
    let failures = 0;
    const deadline = Date.now() + runRequest.interrupt.max_wait_ms + STATUS_POLL_GRACE_MS;
    const finish = (stage: 'done' | 'failed', run: TerminalQuickCommandRun | null, errorCode: string | null) => {
      setState({ request: runRequest, stage, run, errorCode });
      if (stage === 'done') rememberRecent(runRequest.entry, runRequest.line);
      finishedRef.current(runRequest, stage === 'done');
    };
    const poll = async () => {
      let ended = false;
      try {
        const run = await terminalApi.terminalQuickCommandStatus(runRequest.terminalNumber);
        if (cancelled) return;
        failures = 0;
        if (run.run_id === runId && (run.state === 'done' || run.state === 'failed')) {
          ended = true;
          finish(run.state, run, run.state === 'done' ? null : run.error_code ?? ERROR_REQUEST);
        } else if (run.run_id === runId) {
          setState((current) => (current && current.stage === 'running' ? { ...current, run } : current));
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

  const stage = state?.stage;
  useEffect(() => {
    if (stage !== 'done') return undefined;
    const timer = window.setTimeout(() => setState(null), DONE_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'confirm') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (CONFIRM_KEYS.includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        void confirm();
      } else if (CANCEL_KEYS.includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [cancel, confirm, stage]);

  const dialog = state ? (
    <PcTerminalQuickCommandDialog
      state={state}
      onConfirm={() => void confirm()}
      onCancel={cancel}
      onHide={hide}
      errorTranslationKey={errorTranslationKey}
    />
  ) : null;
  return { ask, dialog, activeTerminalNumber: state ? state.request.terminalNumber : null };
}

interface PcTerminalQuickCommandDialogProps {
  state: RunState;
  onConfirm: () => void;
  onCancel: () => void;
  onHide: () => void;
  errorTranslationKey: (errorCode?: string | null) => string;
}

const PcTerminalQuickCommandDialog: React.FC<PcTerminalQuickCommandDialogProps> = ({
  state, onConfirm, onCancel, onHide, errorTranslationKey,
}) => {
  const { t } = useTranslation('pc');
  const { request, stage, run, errorCode } = state;
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (stage === 'confirm') cancelRef.current?.focus();
  }, [stage]);

  const phase = run?.phase ?? 'interrupting';
  const phaseText = t(`terminal.commands.quick.phase.${phase}`, {
    sent: run?.ctrl_c_sent ?? 0,
    count: request.interrupt.ctrl_c_count,
  });
  const buttonClass = 'inline-flex min-w-[6rem] items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={t('terminal.commands.quick.title')}
    >
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-500/20 bg-white p-4 shadow-2xl dark:bg-slate-900">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
          <SquareTerminal className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          {t('terminal.commands.quick.title')}
        </h2>
        <p className="break-all rounded-md bg-slate-500/10 px-2 py-1.5 font-mono text-xs text-slate-800 dark:text-slate-100">
          {request.line}
        </p>
        {stage === 'confirm' && (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('terminal.commands.quick.confirm', {
                number: request.terminalNumber,
                shell: t(`terminal.commands.shellOs.${request.platform}`),
                count: request.interrupt.ctrl_c_count,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className={`${buttonClass} border border-slate-500/30 text-slate-700 hover:bg-slate-500/10 dark:text-slate-200`}
              >
                {t('terminal.commands.quick.no')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-500`}
              >
                {t('terminal.commands.quick.yes')}
              </button>
            </div>
          </>
        )}
        {stage === 'running' && (
          <>
            <p className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200" role="status">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-hidden="true" />
              {phaseText}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onHide} className={`${buttonClass} border border-slate-500/30 text-slate-700 hover:bg-slate-500/10 dark:text-slate-200`}>
                {t('terminal.commands.quick.hide')}
              </button>
            </div>
          </>
        )}
        {stage === 'done' && (
          <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400" role="status">
            <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('terminal.commands.quick.done')}
          </p>
        )}
        {stage === 'failed' && (
          <>
            <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('terminal.commands.quick.failed', { reason: t(errorTranslationKey(errorCode)) })}</span>
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onHide} className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-500`}>
                {t('common.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
