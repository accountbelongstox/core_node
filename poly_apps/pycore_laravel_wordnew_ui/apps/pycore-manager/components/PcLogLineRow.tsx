/**
 * PcLogLineRow — the one renderer for a pycore console log line, shared by the
 * global floating log and tag-filtered log panels (color + translated notes).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PcLogLine } from '../PcLiveContext';

export function pcLogLineColor(l: PcLogLine): string {
  if (l.color) return l.color;
  const lvl = l.level.toLowerCase();
  if (lvl === 'error' || lvl === 'critical') return '#f87171';
  if (lvl === 'warn' || lvl === 'warning') return '#fbbf24';
  if (lvl === 'success') return '#4ade80';
  if (lvl === 'debug') return '#818cf8';
  return '#d4d4d8';
}

export function pcLogLineKey(l: PcLogLine, index: number): string {
  return l.seq !== null ? `s${l.seq}` : `n${l.ts}-${index}`;
}

export const PcLogLineRow: React.FC<{ line: PcLogLine }> = ({ line }) => {
  const { t } = useTranslation('pc');
  return (
    <div className="whitespace-pre-wrap break-all" style={{ color: pcLogLineColor(line) }}>
      {line.noteKey ? t(`floatingLog.${line.noteKey}`, line.noteParams) : line.message}
    </div>
  );
};
