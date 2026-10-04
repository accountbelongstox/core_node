/**
 * Operating-system mark of a pycore node: the Windows panes, the Linux penguin, a monitor otherwise.
 */
import React from 'react';
import { Monitor } from 'lucide-react';

export type PcOsKind = 'windows' | 'linux' | 'unknown';

/** `windows` / `linux` from a backend platform or a tailnet peer OS string. */
export function pcOsKind(value: string | null | undefined): PcOsKind {
  const text = String(value || '').toLowerCase();
  if (text.startsWith('win')) return 'windows';
  if (text.includes('linux') || text.includes('debian') || text.includes('ubuntu') || text.includes('kali')) return 'linux';
  return 'unknown';
}

export const PcOsIcon: React.FC<{ os: PcOsKind; className?: string }> = ({ os, className = 'h-3.5 w-3.5' }) => {
  if (os === 'windows') {
    return (
      <svg viewBox="0 0 16 16" className={`${className} shrink-0`} fill="currentColor" aria-hidden="true">
        <path d="M1 2.6 6.6 1.8v5.6H1zM7.4 1.7 15 .6v6.8H7.4zM1 8.2h5.6v5.6L1 13zM7.4 8.2H15V15l-7.6-1.1z" />
      </svg>
    );
  }
  if (os === 'linux') {
    return (
      <svg viewBox="0 0 16 16" className={`${className} shrink-0`} fill="currentColor" aria-hidden="true">
        <path d="M8 .8c-1.9 0-3 1.5-3 3.4 0 1-.2 1.7-.8 2.6C3.3 8.2 2.6 9.6 2.6 11c0 .5.1.9.3 1.3-.6.3-1.1.7-1.1 1.2 0 .9 1.6 1.2 2.9 1.6.6.2 1 .4 1.4.4.5 0 .8-.3 1.1-.6h1.6c.3.3.6.6 1.1.6.4 0 .8-.2 1.4-.4 1.3-.4 2.9-.7 2.9-1.6 0-.5-.5-.9-1.1-1.2.2-.4.3-.8.3-1.3 0-1.4-.7-2.8-1.6-4.2-.6-.9-.8-1.6-.8-2.6C11 2.3 9.9.8 8 .8z" />
        <ellipse cx="8" cy="10.4" rx="2.6" ry="3.1" className="fill-white/80 dark:fill-slate-200/80" />
        <circle cx="6.9" cy="4.3" r=".6" className="fill-white" />
        <circle cx="9.1" cy="4.3" r=".6" className="fill-white" />
        <path d="M6.9 5.6h2.2L8 6.7z" className="fill-amber-400" />
      </svg>
    );
  }
  return <Monitor className={`${className} shrink-0`} />;
};
