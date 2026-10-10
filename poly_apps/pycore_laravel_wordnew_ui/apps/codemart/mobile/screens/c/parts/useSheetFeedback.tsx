import React, { useCallback, useMemo, useState } from 'react';
import { notify } from '../../../../../../shared/notify/notify';
import type { CmFeedback } from '../../../../shared/cmFeedback';
import { MobileNotice } from '../../../ui';

type SheetNoticeTone = 'error' | 'info';

interface SheetNotice {
  tone: SheetNoticeTone;
  text: string;
}

export interface SheetFeedback {
  feedback: CmFeedback;
  /** Inline notice for the sheet body (errors and hints stay visible above the toast layer). */
  notice: React.ReactNode;
  clear: () => void;
}

/** Feedback for a sheet form: errors and hints inline, success as a toast. */
export function useSheetFeedback(): SheetFeedback {
  const [notice, setNotice] = useState<SheetNotice | null>(null);
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
