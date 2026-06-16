import React, { useState, useEffect } from 'react';
import { Save, Upload, AlertCircle } from 'lucide-react';

interface JsonParamsEditorProps {
  apiId: string;
  initialParams: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  onSave: () => void;
  onLoad: () => void;
}

const JsonParamsEditor: React.FC<JsonParamsEditorProps> = ({
  apiId,
  initialParams,
  onChange,
  onSave,
  onLoad
}) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(initialParams, null, 2));
    setError(null);
  }, [initialParams, apiId]);

  const handleChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
      setError(null);
    } catch (err) {
      setError('Invalid JSON format');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-400">Request Parameters (JSON)</label>
        <div className="flex gap-2">
          <button
            onClick={onLoad}
            className="px-2 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded text-xs hover:bg-blue-600/30 transition-colors flex items-center gap-1"
            title="Load saved params"
          >
            <Upload size={12} />
            Load
          </button>
          <button
            onClick={onSave}
            className="px-2 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded text-xs hover:bg-emerald-600/30 transition-colors flex items-center gap-1"
            title="Save params"
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      <textarea
        value={jsonText}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full h-40 bg-black/60 border ${error ? 'border-red-500/50' : 'border-white/10'} rounded p-3 text-slate-300 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none`}
        spellCheck={false}
      />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

export default JsonParamsEditor;
