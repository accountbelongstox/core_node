import React, { useState } from 'react';
import { User as UserIcon, Copy, Check, Pencil, Save, X } from 'lucide-react';
import { api } from '../../../core/api';
import { absUrl } from '../../../core/utils/absUrl';
import type { DevHistoryPrompt } from '../../../core/api/modules/DevHistoryAPI';
import { toolLabel, toolPill } from './shared';

interface PromptItemProps {
  p: DevHistoryPrompt;
  labels: { copy: string; copied: string; edit: string; save: string; cancel: string; edited: string };
  onSaved: (id: string, text: string) => void;
}

const PromptItem: React.FC<PromptItemProps> = ({ p, labels, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.text);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startEdit = () => {
    setDraft(p.text);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(p.text);
  };

  const save = async () => {
    setSaving(true);
    const res = await api.devHistory.updatePrompt(p.id, draft);
    setSaving(false);
    if (res.success) {
      onSaved(p.id, draft);
      setEditing(false);
    }
  };

  const btn = 'p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors';

  return (
    <li className="px-4 py-3 group">
      <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
        <span className={toolPill(p.tool)}>{toolLabel(p.tool)}</span>
        <UserIcon size={11} /> {p.os_user}
        <span className="truncate">· {p.project}</span>
        {p.edited && <span className="text-amber-500">({labels.edited})</span>}
        <span className="ml-auto">{p.time}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={copy} title={labels.copy} className={btn}>
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {!editing && (
            <button onClick={startEdit} title={labels.edit} className={btn}>
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
            className="w-full text-sm rounded-lg bg-black/5 dark:bg-white/5 border border-indigo-500/30 focus:border-indigo-500/60 outline-none p-2 text-slate-700 dark:text-slate-200 font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || draft.trim() === ''}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 disabled:opacity-50"
            >
              <Save size={12} /> {labels.save}
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={12} /> {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {p.text}
        </p>
      )}

      {p.translation?.english && !editing && (
        <div className="mt-2 pl-2 border-l-2 border-emerald-500/40">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
            <span>EN</span>
            {p.translation.audio?.url && (
              <audio controls preload="none" src={absUrl(p.translation.audio.url)} className="h-6" />
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
            {p.translation.cleaned || p.translation.english}
          </p>
        </div>
      )}
    </li>
  );
};

export default PromptItem;
