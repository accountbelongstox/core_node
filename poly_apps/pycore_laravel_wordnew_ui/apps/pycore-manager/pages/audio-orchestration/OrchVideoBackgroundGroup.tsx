/**
 * Background of the video: solid color, or an image / video imported into the
 * Pycore managed folder (the settings may only reference a path returned by
 * the import route), with a dim veil over media.
 */
import React, { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { pycoreApi, type OrchVideoBackgroundSettings } from '@/apps/pycore-manager/api';
import { OrchColorField, OrchFieldGroup, OrchRangeField, OrchSelectField } from './OrchVideoFields';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { ORCH_INPUT_CLASS, ORCH_SMALL_BUTTON_CLASS } from './orchStyles';
import { ORCH_VIDEO_RANGES, orchBackgroundKindOfPath, orchBaseName } from './orchVideoSettings';

const OrchVideoBackgroundGroup: React.FC<{
  value: OrchVideoBackgroundSettings;
  onChange: (patch: Partial<OrchVideoBackgroundSettings>) => void;
  onError: (message: string | null) => void;
}> = ({ value, onChange, onError }) => {
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const isMedia = value.kind !== 'color';

  const selectKind = (kind: string) => {
    const next = kind as OrchVideoBackgroundSettings['kind'];
    const keepsFile = next !== 'color' && orchBackgroundKindOfPath(value.path) === next;
    onChange({ kind: next, path: keepsFile || next === 'color' ? value.path : '' });
  };

  const importFile = async () => {
    if (!importPath.trim() || importing) return;
    setImporting(true);
    onError(null);
    try {
      const response = await pycoreApi.orchVideoBackgroundImport(importPath.trim());
      if (!response.success || !response.path || !response.kind) throw response;
      onChange({ path: response.path, kind: response.kind });
      setImportPath('');
    } catch (e) {
      onError(orchErrorMessage(e, ORCH_L.actionFailed));
    } finally {
      setImporting(false);
    }
  };

  return (
    <OrchFieldGroup title={ORCH_L.videoGroupBackground}>
      <OrchSelectField
        label={ORCH_L.fieldBackgroundKind}
        value={value.kind}
        onChange={selectKind}
        options={[
          { value: 'color', label: ORCH_L.backgroundColor },
          { value: 'image', label: ORCH_L.backgroundImage },
          { value: 'video', label: ORCH_L.backgroundVideo },
        ]}
      />
      <OrchColorField label={ORCH_L.fieldBackgroundColor} value={value.color} onChange={(color) => onChange({ color })} />
      {isMedia && (
        <OrchRangeField label={ORCH_L.fieldBackgroundDim} value={value.dim} range={ORCH_VIDEO_RANGES.background.dim} onChange={(dim) => onChange({ dim })} />
      )}
      <div className="sm:col-span-2 space-y-1">
        <label className="block text-xs text-slate-400">
          {ORCH_L.backgroundPath}
          <span className="mt-1 flex items-center gap-2">
            <input
              value={importPath}
              onChange={(event) => setImportPath(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void importFile(); }}
              className={ORCH_INPUT_CLASS}
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => void importFile()}
              disabled={importing || !importPath.trim()}
              className={`${ORCH_SMALL_BUTTON_CLASS} shrink-0 py-1.5`}
            >
              {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} {ORCH_L.backgroundImport}
            </button>
          </span>
        </label>
        <p className="text-[10px] text-slate-500">{ORCH_L.backgroundCopyHint}</p>
        {value.path && (
          <p className="flex items-center gap-2 text-[11px] text-slate-400">
            {ORCH_L.backgroundCurrent}: <span className="font-mono text-slate-300 break-all">{orchBaseName(value.path)}</span>
            <button
              type="button"
              onClick={() => onChange({ path: '', kind: 'color' })}
              title={ORCH_L.backgroundClear}
              aria-label={ORCH_L.backgroundClear}
              className="text-slate-500 hover:text-rose-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </p>
        )}
        {isMedia && !value.path && <p className="text-[11px] text-amber-400/80">{ORCH_L.backgroundNeedsFile}</p>}
      </div>
    </OrchFieldGroup>
  );
};

export default OrchVideoBackgroundGroup;
