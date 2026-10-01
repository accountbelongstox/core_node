import React, { useRef, useState } from 'react';
import { CheckCircle2, ClipboardPaste, FileUp, Loader2, Send, Trash2, X, AlertTriangle, RefreshCw, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatShortcut, isUsableShortcut } from './machineSendShortcut';
import type { MachineClipboardEntry } from '../../../../core/integrations/pycore';
import { usePcMachineSend, type MachineFileMode } from './usePcMachineSend';

const KIND_LABEL_KEYS: Record<MachineClipboardEntry['kind'], string> = {
  text: 'machineSend.history.kindText',
  image: 'machineSend.history.kindImage',
  files: 'machineSend.history.kindFiles',
  empty: 'machineSend.history.kindEmpty',
  other: 'machineSend.history.kindOther',
};
const HINT_KEYS = {
  permission: 'machineSend.permissionHint',
  unsupported: 'machineSend.unsupportedHint',
  empty: 'machineSend.emptyClipboard',
} as const;
const PREVIEW_LINES = 3;

const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50';

function HistoryRow({ entry, onDelete }: { entry: MachineClipboardEntry; onDelete: (id: string) => void }) {
  const { t } = useTranslation('pc');
  const [expanded, setExpanded] = useState(false);
  const details = [
    entry.mime,
    entry.bytes !== undefined ? t('machineSend.history.size', { bytes: entry.bytes }) : '',
    ...(entry.formats ?? []),
  ].filter(Boolean).join(' · ');
  return (
    <li className="rounded-lg border border-slate-500/15 bg-white/40 px-2.5 py-1.5 text-[11px] dark:bg-slate-950/30">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-bold">{t(KIND_LABEL_KEYS[entry.kind])}</span>
        <span className="text-slate-500">{new Date(entry.at).toLocaleTimeString()}</span>
        <button type="button" onClick={() => onDelete(entry.id)} title={t('machineSend.history.delete')} className="ml-auto text-slate-400 hover:text-rose-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {entry.kind === 'text' ? (
        <>
          <pre className={`mt-1 whitespace-pre-wrap break-all font-mono text-[10px] ${expanded ? '' : 'line-clamp-3'}`}>{entry.text}</pre>
          {(entry.text ?? '').split('\n').length > PREVIEW_LINES && (
            <button type="button" onClick={() => setExpanded((value) => !value)} className="text-[10px] text-indigo-500">
              {t(expanded ? 'machineSend.history.collapse' : 'machineSend.history.expand')}
            </button>
          )}
        </>
      ) : details && <p className="mt-1 break-all text-[10px] text-slate-500">{details}</p>}
    </li>
  );
}

const PcMachineSendPanelBody: React.FC = () => {
  const { t } = useTranslation('pc');
  const machine = usePcMachineSend();
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<MachineFileMode>('receive');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(false);

  const recordShortcut = (event: React.KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const combo = formatShortcut(event.nativeEvent);
    if (!combo) return;
    if (isUsableShortcut(combo) && machine.setShortcut(combo)) {
      setRecording(false);
      setRecordError(false);
    } else {
      setRecordError(true);
    }
  };

  return (
    <section className="pc-glass space-y-3 p-4">
      <div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('machineSend.title')}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">{t('machineSend.hint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div
          className={`space-y-2 rounded-xl border border-dashed p-3 ${dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-500/25'}`}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('Files')) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            setDragging(false);
            const files = Array.from(event.dataTransfer.files);
            if (!files.length) return;
            event.preventDefault();
            machine.sendFiles(files, mode);
          }}
        >
          <p className="text-[11px] text-slate-500">{t('machineSend.drop')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => pickerRef.current?.click()} className={buttonClass}>
              <FileUp className="h-3.5 w-3.5" />
              {t('machineSend.pick')}
            </button>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as MachineFileMode)}
              className="rounded-lg border border-slate-500/20 bg-white/60 px-2 py-1.5 text-[11px] dark:bg-slate-950/40"
            >
              <option value="receive">{t('machineSend.modeReceive')}</option>
              <option value="clipboard">{t('machineSend.modeClipboard')}</option>
            </select>
          </div>
          <input
            ref={pickerRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              machine.sendFiles(Array.from(event.target.files ?? []), mode);
              event.target.value = '';
            }}
          />
        </div>

        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder={t('machineSend.textPlaceholder')}
            className="w-full resize-y rounded-xl border border-slate-500/20 bg-white/60 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950/40 dark:text-slate-100"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!text} onClick={() => void machine.sendText(text, 'editor')} className={buttonClass}>
              <Send className="h-3.5 w-3.5" />
              {t('machineSend.openEditor')}
            </button>
            <button type="button" disabled={!text} onClick={() => void machine.sendText(text, 'clipboard')} className={buttonClass}>
              <ClipboardPaste className="h-3.5 w-3.5" />
              {t('machineSend.toClipboard')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-500/15 px-3 py-2">
        <button type="button" onClick={() => void machine.syncLocalClipboard()} className={buttonClass}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          {t('machineSend.syncLocal')}
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Keyboard className="h-3.5 w-3.5" />
          {t('machineSend.syncHint', { combo: machine.shortcut })}
        </span>
        <button
          type="button"
          onClick={() => { setRecording((value) => !value); setRecordError(false); }}
          onKeyDown={recording ? recordShortcut : undefined}
          onBlur={() => setRecording(false)}
          className="rounded-lg border border-slate-500/20 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
        >
          {t(recording ? 'machineSend.shortcutRecording' : 'machineSend.shortcutRecord')}
        </button>
        {recordError && <span className="text-[10px] text-amber-500">{t('machineSend.shortcutNeedsModifier')}</span>}
        {machine.hint && <p className="w-full text-[11px] text-amber-600 dark:text-amber-400">{t(HINT_KEYS[machine.hint])}</p>}
      </div>

      {machine.activities.length > 0 && (
        <ul className="space-y-1.5" aria-label={t('machineSend.activities')}>
          {machine.activities.map((activity) => (
            <li key={activity.id} className="rounded-lg border border-slate-500/15 px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                {activity.status === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                {activity.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                {activity.status === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                <span className="font-semibold">{t(`machineSend.kind.${activity.kind}`)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{activity.label}</span>
                <span className="text-slate-500">{t(`machineSend.status.${activity.status}`)}</span>
                <button
                  type="button"
                  onClick={() => (activity.status === 'sending' ? machine.cancel(activity.id) : machine.dismiss(activity.id))}
                  title={t(activity.status === 'sending' ? 'machineSend.cancel' : 'machineSend.dismiss')}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {activity.status === 'sending' && activity.progress > 0 && (
                <div className="mt-1 h-1 rounded bg-slate-500/20">
                  <div className="h-full rounded bg-indigo-500" style={{ width: `${Math.round(activity.progress * 100)}%` }} />
                </div>
              )}
              {activity.results.map((line) => (
                <p key={line.key} className="mt-1 break-all text-[10px] text-emerald-600 dark:text-emerald-400">{t(line.key, line.params)}</p>
              ))}
              {activity.errorKey && <p className="mt-1 text-[10px] text-rose-500">{t(activity.errorKey, activity.errorParams)}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('machineSend.history.title')}</h3>
          <button type="button" onClick={() => void machine.refreshHistory()} title={t('machineSend.history.refresh')} className="ml-auto text-slate-400 hover:text-indigo-500">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {machine.history.length > 0 && (
            <button type="button" onClick={() => void machine.clearHistory()} className="text-[10px] font-semibold text-rose-500">
              {t('machineSend.history.clear')}
            </button>
          )}
        </div>
        {machine.history.length === 0
          ? <p className="text-[11px] text-slate-400">{t('machineSend.history.empty')}</p>
          : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {machine.history.map((entry) => <HistoryRow key={entry.id} entry={entry} onDelete={(id) => void machine.deleteEntry(id)} />)}
            </ul>
          )}
      </div>
    </section>
  );
};

/** Sends documents, files, text and clipboard content to the whole selected pycore machine; hidden until pycore serves its routes. */
export const PcMachineSendPanel: React.FC = () => (
  <PcMachineSendPanelBody />
);
