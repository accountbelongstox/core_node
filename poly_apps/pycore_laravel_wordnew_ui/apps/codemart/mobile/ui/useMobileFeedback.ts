import { useMemo } from 'react';
import { notify } from '../../../../shared/notify/notify';
import type { CmFeedback } from '../../shared/cmFeedback';

/** Feedback channel for shared hooks in the mobile UI: the shell toast system, above the tab bar. */
export function useMobileFeedback(): CmFeedback {
  return useMemo<CmFeedback>(() => ({
    success: (text) => { notify.success(text); },
    error: (text) => { notify.error(text); },
    info: (text) => { notify.info(text); },
    clear: () => undefined,
  }), []);
}
