import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChipButton } from '@/shared/ui/ChipButton';
import { ModalShell } from '@/shared/ui/ModalShell';
import { StateGate } from '@/shared/ui/StateMessage';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { wfNewAdminApi } from '../../api';
import type { ElementTheme } from '../../WfNewThemes';

export type AdminTrans = (key: string, replacements?: Record<string, string | number>) => string;
export type AdminAddToast = (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;

export interface AdminPanelProps {
  activeTheme: ElementTheme;
  trans: AdminTrans;
  addToast: AdminAddToast;
}

export const ADMIN_INPUT_CLS = 'py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none';
export const ADMIN_FALLBACK_LANGUAGES = ['english', 'chinese', 'japanese', 'korean', 'french', 'german', 'spanish'];
const ADMIN_REVEAL_Y_PX = 10;
const ADMIN_REVEAL_SECONDS = 0.2;

/** Input / select class for the active theme. */
export const adminInputClass = (theme: ElementTheme, extra = ''): string => `${ADMIN_INPUT_CLS} ${theme.inputClass} ${extra}`.trim();

/** Fade-up entrance shared by every admin panel. */
export const AdminReveal: React.FC<{ delay?: number; className?: string; children: React.ReactNode }> = ({ delay = 0, className = '', children }) => (
  <motion.div
    initial={{ opacity: 0, y: ADMIN_REVEAL_Y_PX }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: ADMIN_REVEAL_SECONDS, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

/** Themed rounded card holding one admin section. */
export const AdminPanel: React.FC<{ theme: ElementTheme; className?: string; children: React.ReactNode }> = ({ theme, className = 'space-y-4', children }) => (
  <div className={`p-6 rounded-3xl ${theme.cardClass} ${className}`}>{children}</div>
);

/** Small uppercase section label. */
export const AdminLabel: React.FC<{ as?: 'p' | 'h3' | 'span' | 'label'; className?: string; children: React.ReactNode }> = ({ as: Tag = 'p', className = '', children }) => (
  <Tag className={`text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300 ${className}`}>{children}</Tag>
);

/** Labelled form field: uppercase label, the control, optional hint. */
export const AdminField: React.FC<{ label: string; hint?: string; className?: string; children: React.ReactNode }> = ({ label, hint, className = '', children }) => (
  <div className={`space-y-1.5 ${className}`}>
    <AdminLabel as="label" className="block text-zinc-400">{label}</AdminLabel>
    {children}
    {hint && <p className="text-[10px] font-mono text-zinc-500">{hint}</p>}
  </div>
);

/** Row / header selection checkbox. */
export const AdminCheckbox: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <input type="checkbox" checked={checked} onChange={onChange} className="accent-indigo-500 w-3.5 h-3.5 align-middle" />
);

export { StatCard } from '@/shared/ui/StatCard';
export {
  DataTableShell as AdminTableShell,
  DataTable as AdminTable,
  DataTableRow as AdminTableRow,
} from '@/shared/ui/DataTable';

/** Loading / error (with retry) / empty gate in front of an admin list. */
export const AdminAsync: React.FC<{ trans: AdminTrans; loading: boolean; error: string | null; empty: boolean; onRetry: () => void; children: React.ReactNode }> = ({
  trans, loading, error, empty, onRetry, children,
}) => (
  <StateGate
    loading={loading}
    error={error}
    empty={empty}
    loadingText={trans('admin.loading')}
    emptyText={trans('admin.empty')}
    retryLabel={trans('admin.retry')}
    onRetry={onRetry}
  >
    {children}
  </StateGate>
);

/** Confirm dialog on the shared modal layer. */
export const AdminConfirmDialog: React.FC<{ message: string; trans: AdminTrans; onConfirm: () => void; onCancel: () => void }> = ({ message, trans, onConfirm, onCancel }) => (
  <ModalShell onClose={onCancel} cardClassName="relative w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6 text-slate-100 shadow-2xl">
    <p className="text-sm font-bold leading-relaxed">{message}</p>
    <div className="flex items-center justify-end gap-2">
      <ChipButton onClick={onCancel}>{trans('admin.cancel')}</ChipButton>
      <ChipButton variant="danger" onClick={onConfirm}>{trans('admin.confirm')}</ChipButton>
    </div>
  </ModalShell>
);

/** Promise-based confirm: `await confirm(message)` plus the `dialog` node to render once. */
export function useAdminConfirm(trans: AdminTrans): { confirm: (message: string) => Promise<boolean>; dialog: React.ReactNode } {
  const [pending, setPending] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => setPending({ message, resolve })), []);
  const settle = (ok: boolean): void => {
    pending?.resolve(ok);
    setPending(null);
  };
  const dialog = pending
    ? <AdminConfirmDialog message={pending.message} trans={trans} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
    : null;
  return { confirm, dialog };
}

/** Out-of-order / unmount guard: only the latest `begin()` id may commit state. */
export function useRequestGuard(): { begin: () => number; isCurrent: (id: number) => boolean; isAlive: () => boolean } {
  const alive = useRef(true);
  const latest = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const begin = useCallback(() => ++latest.current, []);
  const isCurrent = useCallback((id: number) => alive.current && id === latest.current, []);
  const isAlive = useCallback(() => alive.current, []);
  return useMemo(() => ({ begin, isCurrent, isAlive }), [begin, isCurrent, isAlive]);
}

/** Value that follows `value` after it stayed unchanged for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Dictionary-language selection shared (and persisted) across the words and libraries panels. */
export function useAdminLanguage(defaultLanguage: string): { language: string; setLanguage: (lang: string) => void; options: string[] } {
  const [languages, setLanguages] = useState<string[]>(ADMIN_FALLBACK_LANGUAGES);
  const [language, setLanguageState] = useState<string>(() => {
    try {
      return StorageManager.get(StorageKeys.WORDNEW_ADMIN_LANGUAGE, defaultLanguage);
    } catch {
      return defaultLanguage;
    }
  });

  useEffect(() => {
    let alive = true;
    wfNewAdminApi.getLanguageBreakdown()
      .then((res) => {
        if (!alive) return;
        const list = (res?.languages ?? []).map((row) => row.language).filter(Boolean);
        if (list.length > 0) setLanguages(list);
      })
      .catch(() => { /* keep the fallback list */ });
    return () => { alive = false; };
  }, []);

  const options = useMemo(
    () => (language && !languages.includes(language) ? [...languages, language] : languages),
    [languages, language],
  );

  const setLanguage = useCallback((lang: string): void => {
    setLanguageState(lang);
    if (lang) StorageManager.set(StorageKeys.WORDNEW_ADMIN_LANGUAGE, lang);
  }, []);

  return { language, setLanguage, options };
}

/** One shared <audio> element so admin clips never overlap; `playingKey` names the active clip. */
export function useAdminAudio(): { playingKey: string | null; play: (key: string, url: string) => void; toggle: (key: string, url: string) => void; stop: () => void } {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const stop = useCallback((): void => {
    audioRef.current?.pause();
    setPlayingKey(null);
  }, []);

  const play = useCallback((key: string, url: string): void => {
    audioRef.current?.pause();
    const next = new Audio(url);
    audioRef.current = next;
    const clear = (): void => setPlayingKey((current) => (current === key ? null : current));
    next.onended = clear;
    next.onerror = clear;
    next.play().then(() => setPlayingKey(key)).catch(() => setPlayingKey(null));
  }, []);

  const toggle = useCallback((key: string, url: string): void => {
    if (playingKey === key && audioRef.current) stop();
    else play(key, url);
  }, [playingKey, play, stop]);

  return { playingKey, play, toggle, stop };
}
