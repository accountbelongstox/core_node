import React, { useState } from 'react';
import { Copy, Save, RotateCcw, Check } from 'lucide-react';

interface SharedHeadersManagerProps {
  appName: string;
  headers: Record<string, string>;
  supportedHeaders?: string[];
  onChange: (headers: Record<string, string>) => void;
  onSave: () => void;
  onReset: () => void;
}

const SharedHeadersManager: React.FC<SharedHeadersManagerProps> = ({
  appName,
  headers,
  supportedHeaders = [],
  onChange,
  onSave,
  onReset
}) => {
  const [copied, setCopied] = useState(false);

  const defaultHeaders = supportedHeaders.length > 0
    ? supportedHeaders
    : ['Authorization', 'Content-Type', 'Accept', 'X-API-Key'];

  const handleHeaderChange = (key: string, value: string) => {
    onChange({ ...headers, [key]: value });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(headers, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          {appName} - Shared Headers
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            title="Copy headers JSON"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1.5 bg-lime-500/20 text-lime-400 border border-lime-500/30 rounded text-xs hover:bg-lime-500/30 transition-colors flex items-center gap-1"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 bg-slate-600/20 text-slate-400 border border-slate-600/30 rounded text-xs hover:bg-slate-600/30 transition-colors flex items-center gap-1"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {defaultHeaders.map(headerName => (
          <div key={headerName} className="grid grid-cols-[140px_1fr] gap-3 items-center text-sm">
            <span className="text-slate-400 font-mono text-xs">{headerName}:</span>
            <input
              type={headerName.toLowerCase().includes('token') || headerName.toLowerCase().includes('auth') ? 'password' : 'text'}
              value={headers[headerName] || ''}
              onChange={(e) => handleHeaderChange(headerName, e.target.value)}
              placeholder={`Enter ${headerName}`}
              className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-slate-300 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedHeadersManager;
