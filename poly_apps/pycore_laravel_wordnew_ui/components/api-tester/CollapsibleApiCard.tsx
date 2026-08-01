import React, { useState } from 'react';
import { ChevronDown, ChevronRight, PlayCircle, Lock, LockOpen } from 'lucide-react';
import { ApiInfoParsedEndpoint } from '../../apps/laravel-manager/uiTypes';
import JsonParamsEditor from './JsonParamsEditor';

interface CollapsibleApiCardProps {
  endpoint: ApiInfoParsedEndpoint;
  isExpanded: boolean;
  params: Record<string, any>;
  onToggle: () => void;
  onParamsChange: (params: Record<string, any>) => void;
  onSendRequest: () => void;
  onSaveParams: () => void;
  onLoadParams: () => void;
  loading?: boolean;
}

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    POST: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    PUT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
    PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[method] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {method}
    </span>
  );
};

const CollapsibleApiCard: React.FC<CollapsibleApiCardProps> = ({
  endpoint,
  isExpanded,
  params,
  onToggle,
  onParamsChange,
  onSendRequest,
  onSaveParams,
  onLoadParams,
  loading
}) => {
  const isAuthRequired = endpoint.authType === 'auth_required';

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">
      <div
        className="p-3 cursor-pointer flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-slate-500 text-xs">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="text-slate-600 dark:text-slate-500 font-mono text-xs">#{endpoint.id.replace('api_', '')}</span>
          <MethodBadge method={endpoint.method} />
          <span className="font-mono text-sm text-slate-200 truncate">{endpoint.path}</span>
          {isAuthRequired ? (
            <span title="Auth Required" className="inline-flex">
              <Lock size={14} className="text-red-400" />
            </span>
          ) : (
            <span title="Auth Optional" className="inline-flex">
              <LockOpen size={14} className="text-green-400" />
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 ml-2">{endpoint.description}</span>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-white/10 space-y-4 bg-black/20">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Authentication:</span>
              <span className={`ml-2 font-mono ${isAuthRequired ? 'text-red-400' : 'text-green-400'}`}>
                {isAuthRequired ? 'Required' : 'Optional'}
              </span>
            </div>
            {endpoint.controller && (
              <div>
                <span className="text-slate-500">Controller:</span>
                <span className="ml-2 font-mono text-slate-300">{endpoint.controller}</span>
              </div>
            )}
          </div>

          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Parameters:</h4>
              <div className="space-y-1 text-xs">
                {endpoint.params.map(param => (
                  <div key={param.name} className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{param.name}</span>
                    <span className="text-slate-500">({param.type})</span>
                    <span className={param.requirement === 'required' ? 'text-red-400' : 'text-green-400'}>
                      {param.requirement}
                    </span>
                    {param.example && (
                      <span className="text-slate-500">Example: <code className="text-slate-400">{param.example}</code></span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.response && endpoint.response.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Response Format:</h4>
              <div className="space-y-1 text-xs">
                {endpoint.response.map(resp => (
                  <div key={resp.name} className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{resp.name}</span>
                    <span className="text-slate-500">({resp.type})</span>
                    {resp.description && <span className="text-slate-400">- {resp.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Endpoint URL:</label>
            <input
              type="text"
              value={endpoint.path}
              readOnly
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-slate-300 font-mono text-xs"
            />
          </div>

          <JsonParamsEditor
            apiId={endpoint.id}
            initialParams={params}
            onChange={onParamsChange}
            onSave={onSaveParams}
            onLoad={onLoadParams}
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendRequest();
            }}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white py-2 px-4 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle size={16} />
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CollapsibleApiCard;
