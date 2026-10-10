import React, { useCallback, useMemo, useState } from 'react';
import { notify } from '../../../../shared/notify/notify';
import type { CmFeedback } from '../../shared/cmFeedback';
import { MobileNotice } from './MobileNotice';

type InlineNoticeTone = 'error' | 'info';

interface InlineNotice {
  tone: InlineNoticeTone;
  text: string;
}

export interface InlineFeedback {
  feedback: CmFeedback;
  /** Inline notice for the sheet body (errors and hints stay next to the form that raised them). */
  notice: React.ReactNode;
  clear: () => void;
}

/** Feedback for a form in a sheet or card: errors and hints inline, success as a toast. */
export function useInlineFeedback(): InlineFeedback {
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const clear = useCallback(() => setNotice(null), []);
  const feedback = useMemo<CmFeedback>(() => ({
    success: (text) => {
      setNotice(null);
      notify.success(text);
    },
    error: (text) => setNotice({ tone: 'error', text }),
    info: (text) => setNotice({ tone: 'info', text }),
    clear,
  }), [clear]);
  return { feedback, notice: notice ? <MobileNotice tone={notice.tone}>{notice.text}</MobileNotice> : null, clear };
}
