/**
 * Copy a value to the system clipboard (native clipboard in the app, the
 * browser clipboard on the web) with a success / failure toast.
 */
import React from 'react';
import { Copy } from 'lucide-react';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { notify } from '@/shared/notify/notify';

interface Props {
  value: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  className?: string;
}

export const WfNewCopyButton: React.FC<Props> = ({ value, trans, className = '' }) => (
  <button
    type="button"
    onClick={(event) => {
      // Inside clickable rows the copy never triggers the row.
      event.stopPropagation();
      void copyTextToSystemClipboard(value).then((ok) => (ok ? notify.success(trans('copy.done')) : notify.warning(trans('copy.failed'))));
    }}
    className={`shrink-0 rounded p-1 text-zinc-400 hover:text-indigo-500 ${className}`}
    aria-label={trans('copy.action')}
    title={trans('copy.action')}
  >
    <Copy className="h-3 w-3" />
  </button>
);
