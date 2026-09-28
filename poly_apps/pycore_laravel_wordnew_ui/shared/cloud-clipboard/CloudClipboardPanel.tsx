import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Link, LockKeyhole, Plus } from 'lucide-react';
import { CLOUD_CLIPBOARD } from '../../core/contracts/CloudClipboardContract';
import { CloudClipboardModel } from './CloudClipboardModel';
import CloudClipboardEntryCard from './CloudClipboardEntryCard';
import { copyTextToSystemClipboard } from '../../core/browser/SystemClipboard';
import { createCloudClipboardShareUrl } from './CloudClipboardNavigation';
import './CloudClipboardLocales';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-500/10 disabled:opacity-40';
const inputClass = 'rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm min-w-0';
const cardClass = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3';

export interface CloudClipboardPanelProps {
  namespace?: string;
  onNamespaceChange?: (namespace: string) => void;
  shareUrl?: string;
  embedded?: boolean;
}

export default function CloudClipboardPanel({ namespace: namespaceValue = '', onNamespaceChange, shareUrl, embedded = false }: CloudClipboardPanelProps) {
  const { t } = useTranslation('cloudClipboard');
  const [localNamespace, setLocalNamespace] = useState(namespaceValue);
  const namespace = (onNamespaceChange ? namespaceValue : localNamespace).trim().toLowerCase();
  const model = useMemo(() => new CloudClipboardModel(namespace), [namespace]);
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const [namespaceInput, setNamespaceInput] = useState(namespace);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordPending, setPasswordPending] = useState(false);
  const passwordChanged = useRef(false);
  const snapshot = state.snapshot;

  useEffect(() => {
    setLocalNamespace(namespaceValue);
  }, [namespaceValue]);

  useEffect(() => {
    setNamespaceInput(namespace);
    setPassword('');
    setNewPassword('');
    setNotice('');
    setPasswordPending(false);
    passwordChanged.current = false;
    model.start();
    return () => model.stop();
  }, [model, namespace]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (!model.getState().pendingIds.length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [model]);

  const openNamespace = async (value: string): Promise<void> => {
    const normalized = value.trim().toLowerCase();
    const pending = model.getState().pendingIds;
    let results: boolean[];
    if (normalized && !new RegExp(CLOUD_CLIPBOARD.namespace_pattern).test(normalized)) { setNotice('invalidInput'); return; }
    if (pending.length) {
      results = await Promise.all(pending.map((id) => model.flush(id)));
      if (results.some((result) => !result) || model.getState().pendingIds.length) return;
    }
    if (onNamespaceChange) onNamespaceChange(normalized);
    else setLocalNamespace(normalized);
  };

  const generate = async (): Promise<void> => {
    let generatedNamespace: string;
    try {
      generatedNamespace = await model.generateNamespace();
      await openNamespace(generatedNamespace);
    } catch { setNotice('requestFailed'); }
  };

  const copyLink = async (): Promise<void> => {
    const copied = await copyTextToSystemClipboard(shareUrl ?? createCloudClipboardShareUrl(namespace));
    setNotice(copied ? 'copied' : 'copyFailed');
  };

  const updatePassword = async (): Promise<void> => {
    const current = model.getState().snapshot?.current;
    const value = newPassword;
    if (!current || !passwordChanged.current || passwordPending) return;
    setPasswordPending(true);
    try {
      if (await model.action('password', current.id, { new_password: value })) {
        passwordChanged.current = false;
        setNewPassword('');
      }
    } finally { setPasswordPending(false); }
  };

  return <section className={`${embedded ? 'p-3 sm:p-4' : 'p-4 md:p-6 max-w-7xl mx-auto'} space-y-5 text-slate-800 dark:text-slate-200`}>
    <div className="flex gap-3 items-start">
      <Cloud className="shrink-0 text-indigo-500 mt-1" size={28} />
      <div className="mr-auto"><h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('description')}</p></div>
      <button type="button" disabled={!snapshot || state.locked || state.adding}
        title={t('addEntry')} aria-label={t('addEntry')} onClick={() => void model.addEntry()}
        className="h-11 w-11 shrink-0 rounded-xl bg-indigo-500 text-white inline-flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40">
        <Plus size={24} />
      </button>
    </div>
    <div className={cardClass}>
      <form className="flex gap-2 flex-wrap items-end" onSubmit={(event) => { event.preventDefault(); void openNamespace(namespaceInput); }}>
        <label className="flex flex-col gap-1 flex-1 min-w-40 text-sm">{t('namespace')}
          <input className={inputClass} value={namespaceInput} onChange={(event) => setNamespaceInput(event.target.value)} placeholder={t('public')} maxLength={40} />
        </label>
        <button className={buttonClass} type="submit">{t('open')}</button>
        <button className={buttonClass} type="button" onClick={() => void generate()}>{t('generate')}</button>
        <button className={buttonClass} type="button" onClick={() => void copyLink()}><Link size={16} />{t('copyLink')}</button>
      </form>
      <p className="text-xs text-slate-500">{t('namespaceHint')}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full bg-indigo-500/10 px-3 py-1">{namespace || t('public')}</span>
        <span title={t(state.live ? 'live' : 'polling')} aria-label={t(state.live ? 'live' : 'polling')}
          className={`h-2 w-2 rounded-full ${state.live ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        {snapshot?.protected && <span className="inline-flex items-center gap-1"><LockKeyhole size={12} />{t('protected')}</span>}
      </div>
    </div>
    {(state.error || notice) && <div role="status" className="rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-sm flex gap-3 flex-wrap items-center">
      <span>{t(state.error ?? notice)}</span>
      {!state.locked && <button type="button" className={buttonClass} onClick={() => { setNotice(''); void model.refresh(true); }}>{t('retry')}</button>}
    </div>}
    {state.locked && <form className={cardClass} onSubmit={(event) => { event.preventDefault(); model.unlock(password); }}>
      <label className="flex flex-col gap-2 text-sm">{t('password')}<input type="password" className={inputClass} autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button type="submit" className={buttonClass}>{t('unlock')}</button>
    </form>}
    {state.loading && !snapshot && !state.locked && <p className="text-sm text-slate-500">{t('loading')}</p>}
    {snapshot && !state.locked && <>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('entryList', { count: snapshot.history_total + 1 })}</h2>
        {state.entries.map((entry) => <CloudClipboardEntryCard key={entry.id} model={model} entry={entry}
          latest={entry.id === snapshot.current.id} busy={state.busyIds.includes(entry.id)} pending={state.pendingIds.includes(entry.id)}
          focus={state.focusEntryId === entry.id} />)}
        {snapshot.page * snapshot.page_size < snapshot.history_total && <div className="flex justify-center">
          <button type="button" className={buttonClass} onClick={() => model.loadMore()}>{t('loadMore')}</button>
        </div>}
      </div>
      <div className={cardClass}>
        <label className="flex flex-col gap-1 text-sm">{t('newPassword')}
          <input className={inputClass} type="password" maxLength={255} autoComplete="new-password" value={newPassword} disabled={passwordPending}
            onChange={(event) => { setNewPassword(event.target.value); passwordChanged.current = true; }} onBlur={() => void updatePassword()} />
        </label><p className="text-xs text-slate-500">{t(passwordPending ? 'saving' : 'passwordAutoSave')}</p>
      </div>
    </>}
  </section>;
}
