import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cloud, Link, LockKeyhole, Plus, Upload, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { CLOUD_CLIPBOARD, type CloudClipboardEntry, type CloudClipboardAction } from '../../core/contracts/CloudClipboardContract';
import { CloudClipboardModel } from './CloudClipboardModel';
import CloudClipboardAttachment from './CloudClipboardAttachment';
import './CloudClipboardLocales';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-500/10 disabled:opacity-40';
const inputClass = 'rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm min-w-0';
const cardClass = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3';

export default function CloudClipboardPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('cloudClipboard');
  const namespace = new URLSearchParams(location.search).get(CLOUD_CLIPBOARD.namespace_query)?.trim().toLowerCase() ?? '';
  const model = useMemo(() => new CloudClipboardModel(namespace), [namespace]);
  const state = useSyncExternalStore(model.subscribe, model.getState);
  const [namespaceInput, setNamespaceInput] = useState(namespace);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<CloudClipboardEntry | null>(null);
  const [historyText, setHistoryText] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const snapshot = state.snapshot;
  const current = snapshot?.current;
  const controlsDisabled = state.busy || state.dirty || state.conflict;

  useEffect(() => {
    setNamespaceInput(namespace);
    setPassword('');
    setNewPassword('');
    setEditing(null);
    setNotice('');
    model.start();
    return () => model.stop();
  }, [model, namespace]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (!model.getState().dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [model]);

  const openNamespace = (value: string): void => {
    const normalized = value.trim().toLowerCase();
    const params = new URLSearchParams(location.search);
    if (normalized && !new RegExp(CLOUD_CLIPBOARD.namespace_pattern).test(normalized)) {
      setNotice('invalidInput');
      return;
    }
    if ((state.dirty || editing) && !window.confirm(t('confirmSwitch'))) return;
    if (normalized) params.set(CLOUD_CLIPBOARD.namespace_query, normalized);
    else params.delete(CLOUD_CLIPBOARD.namespace_query);
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '', hash: window.location.hash });
  };

  const generate = async (): Promise<void> => {
    try {
      const result = await model.api.generate();
      openNamespace(result.namespace);
    } catch {
      setNotice('requestFailed');
    }
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('copied');
    } catch {
      setNotice('requestFailed');
    }
  };

  const action = async (name: CloudClipboardAction, entry: CloudClipboardEntry, extra: Record<string, unknown> = {}): Promise<boolean> => {
    if (name === 'delete' && !window.confirm(t('confirmDelete'))) return false;
    if (name === 'delete-file' && !window.confirm(t('confirmFile'))) return false;
    return model.action(name, entry, extra);
  };

  const upload = async (files: File[]): Promise<void> => {
    const latest = model.getState().snapshot?.current;
    let refreshed: CloudClipboardEntry | undefined;
    if (!files.length || !latest || state.busy || state.conflict) return;
    if (files.length > CLOUD_CLIPBOARD.max_files_per_upload
      || files.some((file) => file.size > CLOUD_CLIPBOARD.max_file_kb * 1024)) {
      setNotice('invalidInput');
      return;
    }
    if (model.getState().dirty && !(await model.save())) return;
    if (model.getState().dirty) return;
    refreshed = model.getState().snapshot?.current;
    if (refreshed) await model.action('upload', refreshed, {}, files);
  };

  const attachments = (entry: CloudClipboardEntry) => <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
    {entry.files.map((file) => <CloudClipboardAttachment key={file.id} model={model} entryId={entry.id} file={file}
      disabled={controlsDisabled} onRemove={() => void action('delete-file', entry, { file_id: file.id })} />)}
  </div>;

  return <section className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto text-slate-800 dark:text-slate-200">
    <div className="flex gap-3 items-start"><Cloud className="shrink-0 text-indigo-500 mt-1" size={28} />
      <div><h1 className="text-2xl font-semibold">{t('title')}</h1><p className="text-sm text-slate-500 mt-1">{t('description')}</p></div>
    </div>
    <div className={cardClass}>
      <form className="flex gap-2 flex-wrap items-end" onSubmit={(event) => { event.preventDefault(); openNamespace(namespaceInput); }}>
        <label className="flex flex-col gap-1 flex-1 min-w-40 text-sm">{t('namespace')}
          <input className={inputClass} value={namespaceInput} onChange={(event) => setNamespaceInput(event.target.value)} placeholder={t('public')} maxLength={40} />
        </label>
        <button className={buttonClass} type="submit" disabled={state.busy}>{t('open')}</button>
        <button className={buttonClass} type="button" disabled={state.busy} onClick={() => void generate()}>{t('generate')}</button>
        <button className={buttonClass} type="button" onClick={() => void copyLink()}><Link size={16} />{t('copyLink')}</button>
      </form>
      <p className="text-xs text-slate-500">{t('namespaceHint')}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full bg-indigo-500/10 px-3 py-1">{namespace || t('public')}</span>
        <span className={state.live ? 'text-emerald-500' : 'text-amber-500'}>{t(state.live ? 'live' : 'polling')}</span>
        {snapshot?.protected && <span className="inline-flex items-center gap-1"><LockKeyhole size={12} />{t('protected')}</span>}
      </div>
    </div>
    {(state.error || notice) && <div role="status" className="rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-sm flex gap-3 flex-wrap items-center">
      <span>{t(state.error ?? notice)}</span>
      {!state.locked && !state.conflict && <button type="button" className={buttonClass} onClick={() => { setNotice(''); void model.refresh(true); }}>{t('retry')}</button>}
    </div>}
    {state.locked && <form className={cardClass} onSubmit={(event) => { event.preventDefault(); model.unlock(password); }}>
      <label className="flex flex-col gap-2 text-sm">{t('password')}<input type="password" className={inputClass} autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button type="submit" className={buttonClass}>{t('unlock')}</button>
    </form>}
    {state.loading && !snapshot && !state.locked && <p className="text-sm text-slate-500">{t('saving')}</p>}
    {snapshot && current && <>
      <div className={cardClass} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
        <div className="flex items-center gap-2 flex-wrap"><h2 className="text-lg font-semibold mr-auto">{t('current')}</h2>
          <span className="text-xs text-slate-500" aria-live="polite">{t(state.busy ? 'saving' : state.dirty ? 'pending' : 'saved')}</span>
          <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={() => void action('new', current)}><Plus size={16} />{t('new')}</button>
          <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={() => void action('delete', current)}><Trash2 size={16} />{t('delete')}</button>
        </div>
        <textarea className={`${inputClass} w-full min-h-64 resize-y font-mono`} value={state.draft} maxLength={CLOUD_CLIPBOARD.max_text_length}
          placeholder={t('placeholder')} aria-label={t('current')} disabled={state.busy && !state.dirty}
          onChange={(event) => model.edit(event.target.value)}
          onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); void upload(Array.from(event.clipboardData.files)); } }} />
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" multiple ref={uploadInput} className="hidden" onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
          <button type="button" className={buttonClass} disabled={state.busy || state.conflict} onClick={() => uploadInput.current?.click()}><Upload size={16} />{t('upload')}</button>
          <button type="button" className={buttonClass} disabled={state.busy || !state.dirty || state.conflict} onClick={() => void model.save()}>{t('save')}</button>
          <span className="text-xs text-slate-500">{t('uploadLimit', { count: CLOUD_CLIPBOARD.max_files_per_upload, mb: CLOUD_CLIPBOARD.max_file_kb / 1024 })}</span>
        </div>
        {state.conflict && <div className="space-y-3 rounded-xl bg-amber-500/10 p-3">
          <h3 className="text-sm font-semibold">{t('cloudVersion')}</h3><pre className="whitespace-pre-wrap break-words text-sm max-h-52 overflow-auto">{current.text}</pre>
          <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={state.busy} onClick={() => void model.preserveDraft()}>{t('preserveDraft')}</button>
            <button type="button" className={buttonClass} disabled={state.busy} onClick={() => model.discardDraft()}>{t('discardDraft')}</button></div>
        </div>}
        {attachments(current)}
      </div>
      <form className={`${cardClass} flex gap-2 flex-wrap items-end`} onSubmit={async (event) => {
        event.preventDefault();
        if (await action('password', current, { new_password: newPassword })) setNewPassword('');
      }}>
        <label className="flex flex-col gap-1 flex-1 min-w-40 text-sm">{t('newPassword')}
          <input className={inputClass} type="password" maxLength={255} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label><button type="submit" className={buttonClass} disabled={controlsDisabled}><LockKeyhole size={16} />{t('setPassword')}</button>
      </form>
      <div className="space-y-3"><h2 className="text-lg font-semibold">{t('history', { count: snapshot.history_total })}</h2>
        {editing && <div className={cardClass}>
          <h3 className="text-sm font-semibold">{t('edit')}</h3>
          <textarea className={`${inputClass} w-full min-h-32`} value={historyText} aria-label={t('history', { count: snapshot.history_total })}
            maxLength={CLOUD_CLIPBOARD.max_text_length} onChange={(event) => setHistoryText(event.target.value)} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={async () => {
              if (await action('text', editing, { text: historyText })) setEditing(null);
            }}>{t('save')}</button>
            <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={async () => {
              const entry = model.getState().snapshot?.current;
              if (!entry || !(await model.action('new', entry))) return;
              model.edit(historyText);
              if (await model.save()) setEditing(null);
            }}>{t('preserveDraft')}</button>
            <button type="button" className={buttonClass} onClick={() => setEditing(null)}>{t('cancel')}</button>
          </div>
        </div>}
        {!snapshot.history.length && <p className="text-sm text-slate-500">{t('emptyHistory')}</p>}
        {snapshot.history.map((entry) => <article key={entry.id} className={cardClass}>
          <div className="flex items-center gap-2 flex-wrap"><time className="text-xs text-slate-500 mr-auto">{new Date(entry.updated_at).toLocaleString()}</time>
            <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={() => { setEditing(entry); setHistoryText(entry.text); }}><Pencil size={14} />{t('edit')}</button>
            <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={() => void action('restore', entry)}><RotateCcw size={14} />{t('restore')}</button>
            <button type="button" className={buttonClass} disabled={controlsDisabled} onClick={() => void action('delete', entry)}><Trash2 size={14} />{t('delete')}</button>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm max-h-64 overflow-auto">{entry.text}</pre>
          {attachments(entry)}
        </article>)}
        <div className="flex gap-3 items-center justify-center">
          <button type="button" className={buttonClass} disabled={state.busy || snapshot.page <= 1 || !!editing} onClick={() => model.setPage(snapshot.page - 1)}>{t('previous')}</button>
          <span className="text-sm">{t('page', { page: snapshot.page })}</span>
          <button type="button" className={buttonClass} disabled={state.busy || snapshot.page * snapshot.page_size >= snapshot.history_total || !!editing} onClick={() => model.setPage(snapshot.page + 1)}>{t('next')}</button>
        </div>
      </div>
    </>}
  </section>;
}
