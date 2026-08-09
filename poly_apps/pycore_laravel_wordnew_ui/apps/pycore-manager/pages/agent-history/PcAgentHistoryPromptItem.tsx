import React from 'react';
import { User as UserIcon, Copy, Check, Pencil, Save, X } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AgentHistoryPrompt } from '@/apps/pycore-manager/api';
import { toolLabel, toolPill } from '../../../../components/views/dev-history/shared';

/** Prompt row wired to pycore agent-history API (not Laravel dev-history). */
const PcAgentHistoryPromptItem: React.FC<{
  p: AgentHistoryPrompt;
  labels: { copy: string; copied: string; edit: string; save: string; cancel: string; edited: string };
  onSaved: (id: string, text: string) => void;
}> = ({ p, labels, onSaved }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(p.text);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const save = async () => {
    setSaving(true);
    const res = await pycoreApi.updateAgentHistoryPrompt(p.id, draft);
    setSaving(false);
    if (res.success) {
      onSaved(p.id, draft);
      setEditing(false);
    }
  };

  const btn = 'p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors';

  return (
    <li className="px-4 py-3 group list-none rounded-xl border border-slate-200/80 dark:border-white/5 bg-white/60 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
        <span className={toolPill(p.tool)}>{toolLabel(p.tool)}</span>
        <UserIcon size={11} /> {p.os_user}
        {p.edited && <span className="text-amber-500">({labels.edited})</span>}
        <span className="ml-auto">{p.time}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={copy} title={labels.copy} className={btn}>
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {!editing && (
            <button type="button" onClick={() => { setDraft(p.text); setEditing(true); }} title={labels.edit} className={btn}>
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
            <button type="button" onClick={save} disabled={saving || draft.trim() === ''} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
              <Save size={12} /> {labels.save}
            </button>
            <button type="button" onClick={() => { setEditing(false); setDraft(p.text); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500">
              <X size={12} /> {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-48 overflow-auto">{p.text}</p>
      )}
    </li>
  );
};

export default PcAgentHistoryPromptItem;
