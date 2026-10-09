import React from 'react';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { useWordNewAppUpdate } from '../../services/update/useWordNewAppUpdate';
import { WordNewUpdateStatus } from './WordNewUpdateStatus';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

const VISIBLE = new Set(['available', 'checking', 'downloading', 'needsPermission', 'installing', 'error']);

/** Non-blocking update notice (Android app only): shown while a newer build is offered or being installed. */
export const WordNewUpdateBanner: React.FC<{ trans: Trans }> = ({ trans }) => {
  const update = useWordNewAppUpdate();
  const active = update.status === 'downloading' || update.status === 'needsPermission' || update.status === 'installing';
  if (!update.supported || !update.candidate || !VISIBLE.has(update.status) || (update.dismissed && !active)) return null;
  return (
    <div className={`pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] ${OVERLAY_Z.modal} flex justify-center`}>
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-indigo-500/30 bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-slate-900/95">
        <WordNewUpdateStatus update={update} trans={trans} variant="banner" />
      </div>
    </div>
  );
};

export default WordNewUpdateBanner;
