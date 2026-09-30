/** Style selector and actions of the video look panel (built-in styles are read-only). */
import React from 'react';
import { Check, Copy, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { OrchVideoPreset } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import { ORCH_INPUT_CLASS, ORCH_PRIMARY_BUTTON_CLASS, ORCH_SMALL_BUTTON_CLASS } from './orchStyles';

const presetLabel = (preset: OrchVideoPreset, activeId: string): string => {
  const tags = [
    preset.builtin ? ORCH_L.videoStyleBuiltin : '',
    preset.id === activeId ? ORCH_L.videoStyleActive : '',
  ].filter(Boolean);
  return tags.length ? `${preset.name} (${tags.join(', ')})` : preset.name;
};

const OrchVideoPresetToolbar: React.FC<{
  presets: OrchVideoPreset[];
  activeId: string;
  selectedId: string;
  name: string;
  dirty: boolean;
  busy: boolean;
  onSelect: (presetId: string) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onRevert: () => void;
}> = ({
  presets, activeId, selectedId, name, dirty, busy,
  onSelect, onNameChange, onSave, onSaveAsNew, onDelete, onActivate, onRevert,
}) => {
  const selected = presets.find((preset) => preset.id === selectedId);
  const builtin = selected?.builtin ?? true;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          {ORCH_L.videoStyle}
          <select value={selectedId} onChange={(event) => onSelect(event.target.value)} className={`mt-1 ${ORCH_INPUT_CLASS}`}>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{presetLabel(preset, activeId)}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          {ORCH_L.videoStyleName}
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}
            maxLength={60}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSave} disabled={busy || builtin} className={ORCH_PRIMARY_BUTTON_CLASS}>
          <Save className="w-3.5 h-3.5" /> {ORCH_L.videoSave}
        </button>
        <button type="button" onClick={onSaveAsNew} disabled={busy} className={`${ORCH_SMALL_BUTTON_CLASS} py-1.5 text-sm`}>
          <Copy className="w-3.5 h-3.5" /> {ORCH_L.videoSaveAsNew}
        </button>
        <button type="button" onClick={onActivate} disabled={busy || selectedId === activeId} className={`${ORCH_SMALL_BUTTON_CLASS} py-1.5 text-sm`}>
          <Check className="w-3.5 h-3.5" /> {ORCH_L.videoSetActive}
        </button>
        <button type="button" onClick={onDelete} disabled={busy || builtin} className={`${ORCH_SMALL_BUTTON_CLASS} py-1.5 text-sm text-rose-400 hover:border-rose-500/50`}>
          <Trash2 className="w-3.5 h-3.5" /> {ORCH_L.videoDelete}
        </button>
        <button type="button" onClick={onRevert} disabled={busy || !dirty} className={`${ORCH_SMALL_BUTTON_CLASS} py-1.5 text-sm`}>
          <RotateCcw className="w-3.5 h-3.5" /> {ORCH_L.videoRevert}
        </button>
        {dirty && <span className="text-[11px] text-amber-400">{ORCH_L.videoUnsaved}</span>}
      </div>
      {builtin && <p className="text-[11px] text-slate-500">{ORCH_L.videoBuiltinReadonly}</p>}
    </div>
  );
};

export default OrchVideoPresetToolbar;
