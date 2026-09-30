/**
 * Video look panel: choose, edit, save and activate the video styles that
 * every video task renders with (unless it picks its own), with a live
 * preview re-rendered by pycore from the unsaved settings.
 *
 * "Sentence captions" are outlined text lines; "Word chips" are boxed text with
 * the Chinese meaning underneath. Built-in styles are read-only: edit freely to
 * preview, then Save as new.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Palette } from 'lucide-react';
import {
  pycoreApi,
  type OrchVideoPreset,
  type OrchVideoPresetSaveResponse,
  type OrchVideoSettings,
} from '@/apps/pycore-manager/api';
import { VocabBanner } from '../vocabulary/vocabShared';
import OrchVideoPresetToolbar from './OrchVideoPresetToolbar';
import OrchVideoPreview from './OrchVideoPreview';
import OrchVideoSettingsForm from './OrchVideoSettingsForm';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { ORCH_PANEL_CLASS } from './orchStyles';
import { cloneOrchVideoSettings, sameOrchVideoSettings } from './orchVideoSettings';
import { useOrchVideoPreview } from './useOrchVideoPreview';
import type { OrchVideoPresetsState } from './useOrchVideoPresets';

const NAME_COPY_SEPARATOR = ' ';

const OrchVideoPresetPanel: React.FC<{ state: OrchVideoPresetsState }> = ({ state }) => {
  const { data, error: loadError, apply } = state;
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<OrchVideoSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useOrchVideoPreview(draft, open);
  const selected = data?.presets.find((preset) => preset.id === selectedId) || null;
  const activePreset = data?.presets.find((preset) => preset.id === data.active) || null;
  const dirty = Boolean(selected && draft && (
    !sameOrchVideoSettings(draft, selected.settings) || (!selected.builtin && name.trim() !== selected.name)
  ));

  const loadPreset = useCallback((preset: OrchVideoPreset) => {
    setSelectedId(preset.id);
    setName(preset.name);
    setDraft(cloneOrchVideoSettings(preset.settings));
  }, []);

  useEffect(() => {
    if (!data || selectedId) return;
    const initial = data.presets.find((preset) => preset.id === data.active) || data.presets[0];
    if (initial) loadPreset(initial);
  }, [data, selectedId, loadPreset]);

  const mutate = async (
    call: () => Promise<OrchVideoPresetSaveResponse>,
    after: (response: OrchVideoPresetSaveResponse) => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const response = await call();
      if (!response.success) throw response;
      apply(response);
      after(response);
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.actionFailed));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!selected || !draft) return;
    void mutate(
      () => pycoreApi.orchVideoPresetSave(selected.id, name.trim(), draft, false),
      (response) => {
        const saved = response.presets.find((preset) => preset.id === (response.preset_id || selected.id));
        if (saved) loadPreset(saved);
      },
    );
  };

  const saveAsNew = () => {
    if (!data || !draft) return;
    const taken = new Set(data.presets.map((preset) => preset.name));
    const base = name.trim() || ORCH_L.videoNewStyleName;
    const newName = taken.has(base) ? `${base}${NAME_COPY_SEPARATOR}${ORCH_L.videoCopySuffix}` : base;
    void mutate(
      () => pycoreApi.orchVideoPresetSave('', newName, draft, false),
      (response) => {
        const created = response.presets.find((preset) => preset.id === response.preset_id);
        if (created) loadPreset(created);
      },
    );
  };

  const remove = () => {
    if (!selected || selected.builtin || !window.confirm(ORCH_L.videoConfirmDelete)) return;
    void mutate(
      () => pycoreApi.orchVideoPresetDelete(selected.id),
      (response) => {
        const next = response.presets.find((preset) => preset.id === response.active) || response.presets[0];
        if (next) loadPreset(next);
      },
    );
  };

  const activate = () => {
    if (!selected) return;
    void mutate(() => pycoreApi.orchVideoPresetActivate(selected.id), () => undefined);
  };

  const selectPreset = (presetId: string) => {
    const next = data?.presets.find((preset) => preset.id === presetId);
    if (next) loadPreset(next);
  };

  return (
    <section className={ORCH_PANEL_CLASS}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">{ORCH_L.videoPanelTitle}</span>
          {activePreset && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              {activePreset.name}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">{ORCH_L.videoPanelHint}</p>
          {(loadError || error) && <VocabBanner kind="error" message={error || loadError || ''} />}
          {data && draft && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-3">
                <OrchVideoPresetToolbar
                  presets={data.presets}
                  activeId={data.active}
                  selectedId={selectedId}
                  name={name}
                  dirty={dirty}
                  busy={busy}
                  onSelect={selectPreset}
                  onNameChange={setName}
                  onSave={save}
                  onSaveAsNew={saveAsNew}
                  onDelete={remove}
                  onActivate={activate}
                  onRevert={() => selected && loadPreset(selected)}
                />
                <OrchVideoSettingsForm
                  settings={draft}
                  fonts={data.fonts}
                  fontsDirectory={data.fonts_directory}
                  onChange={setDraft}
                  onError={setError}
                />
              </div>
              <div className="order-first xl:order-none xl:sticky xl:top-4 self-start">
                <OrchVideoPreview preview={preview} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default OrchVideoPresetPanel;
