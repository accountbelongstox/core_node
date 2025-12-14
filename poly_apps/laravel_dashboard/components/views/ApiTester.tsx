import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Loader2, AlertCircle, Clock } from 'lucide-react';
import { api } from '../../core/api';
import { FullApiInfo, ApiInfo, ApiInfoParsedEndpoint, Language } from '../../types';
import { parseFeatureString, generateExampleParams } from '../../utils/apiInfoParser';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { TRANSLATIONS } from '../../constants';
import BentoCard from '../BentoCard';
import SharedHeadersManager from '../api-tester/SharedHeadersManager';
import CollapsibleApiCard from '../api-tester/CollapsibleApiCard';

interface ApiTesterProps {
  lang?: Language;
}

const ApiTester: React.FC<ApiTesterProps> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].api_tester;
  const [fullApiInfo, setFullApiInfo] = useState<FullApiInfo | null>(null);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAppDropdown, setShowAppDropdown] = useState(false);

  const [sharedHeaders, setSharedHeaders] = useLocalStorage<Record<string, Record<string, string>>>('api_tester_headers', {});
  const [apiParams, setApiParams] = useLocalStorage<Record<string, Record<string, any>>>('api_tester_params', {});
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState<string | null>(null);

  useEffect(() => {
    loadApiInfo();
  }, []);

  const loadApiInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.systemConfig.getFullApiInfo();
      if (response.success && response.data) {
        setFullApiInfo(response.data);
        const apps = Object.keys(response.data.api_reference || {});
        if (apps.length > 0 && !selectedApp) {
          setSelectedApp(apps[0]);
        }
      } else {
        setError(response.error || 'Failed to load API info');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const apps = useMemo(() => {
    if (!fullApiInfo?.api_reference) return [];
    return Object.keys(fullApiInfo.api_reference).sort();
  }, [fullApiInfo]);

  const currentAppInfo: ApiInfo | null = useMemo(() => {
    if (!fullApiInfo?.api_reference || !selectedApp) return null;
    return fullApiInfo.api_reference[selectedApp] || null;
  }, [fullApiInfo, selectedApp]);

  const parsedEndpoints: ApiInfoParsedEndpoint[] = useMemo(() => {
    if (!currentAppInfo?.endpoints) return [];
    return currentAppInfo.endpoints.map((ep, idx) => parseFeatureString(ep, idx + 1));
  }, [currentAppInfo]);

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery) return parsedEndpoints;
    const query = searchQuery.toLowerCase();
    return parsedEndpoints.filter(ep =>
      ep.id.includes(query) ||
      ep.path.toLowerCase().includes(query) ||
      ep.description.toLowerCase().includes(query) ||
      ep.method.toLowerCase().includes(query)
    );
  }, [parsedEndpoints, searchQuery]);

  const currentHeaders = sharedHeaders[selectedApp] || {};
  const supportedHeaders = currentAppInfo?.supported_headers || [];

  const handleHeadersChange = (headers: Record<string, string>) => {
    setSharedHeaders({ ...sharedHeaders, [selectedApp]: headers });
  };

  const handleHeadersSave = () => {
    console.log('Headers saved to localStorage');
  };

  const handleHeadersReset = () => {
    const newHeaders = { ...sharedHeaders };
    delete newHeaders[selectedApp];
    setSharedHeaders(newHeaders);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getApiParams = (apiId: string): Record<string, any> => {
    if (apiParams[apiId]) return apiParams[apiId];
    const endpoint = parsedEndpoints.find(ep => ep.id === apiId);
    return generateExampleParams(endpoint?.params);
  };

  const handleParamsChange = (apiId: string, params: Record<string, any>) => {
    setApiParams({ ...apiParams, [apiId]: params });
  };

  const handleSaveParams = (apiId: string) => {
    console.log(`Params for ${apiId} saved to localStorage`);
  };

  const handleLoadParams = (apiId: string) => {
    console.log(`Params for ${apiId} loaded from localStorage`);
  };

  const handleSendRequest = async (endpoint: ApiInfoParsedEndpoint) => {
    setRequestLoading(endpoint.id);
    setLastResponse(null);

    try {
      const params = getApiParams(endpoint.id);
      let url = endpoint.path;
      let body: any = null;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...currentHeaders
      };

      if (endpoint.method === 'GET' && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            queryParams.append(key, String(value));
          }
        });
        if (queryParams.toString()) {
          url += '?' + queryParams.toString();
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        body = JSON.stringify(params);
      }

      const startTime = Date.now();
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body
      });

      const latency = Date.now() - startTime;
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      setLastResponse({
        success: response.ok,
        statusCode: response.status,
        latency,
        data,
        endpoint: endpoint.id
      });
    } catch (err: any) {
      setLastResponse({
        success: false,
        statusCode: 0,
        latency: 0,
        data: { error: err.message || 'Network error' },
        endpoint: endpoint.id
      });
    } finally {
      setRequestLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-400 gap-4">
        <AlertCircle size={48} />
        <p>{error}</p>
        <button
          onClick={loadApiInfo}
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{t.title}</h2>
          <p className="text-xs text-slate-400">
            {filteredEndpoints.length} {filteredEndpoints.length === 1 ? t.endpoint : t.endpoints} • {selectedApp}
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-64">
            <button
              onClick={() => setShowAppDropdown(!showAppDropdown)}
              className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-slate-300 hover:bg-black/50 transition-colors flex items-center justify-between"
            >
              <span className="font-mono">{selectedApp || t.select_app}</span>
              <ChevronDown size={16} className={`transition-transform ${showAppDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showAppDropdown && (
              <div className="absolute top-full mt-1 w-full bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {apps.map(app => (
                  <button
                    key={app}
                    onClick={() => {
                      setSelectedApp(app);
                      setShowAppDropdown(false);
                      setExpandedIds(new Set());
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${selectedApp === app ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300'}`}
                  >
                    {app}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1 md:w-96">
            <input
              type="text"
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-4 pr-10 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {currentAppInfo && (
        <BentoCard title="" className="mb-6 flex-shrink-0">
          <SharedHeadersManager
            appName={selectedApp}
            headers={currentHeaders}
            supportedHeaders={supportedHeaders}
            onChange={handleHeadersChange}
            onSave={handleHeadersSave}
            onReset={handleHeadersReset}
          />
        </BentoCard>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredEndpoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Search size={48} className="mb-4 opacity-50" />
              <p>{t.no_endpoints}</p>
            </div>
          ) : (
            filteredEndpoints.map(endpoint => (
              <CollapsibleApiCard
                key={endpoint.id}
                endpoint={endpoint}
                isExpanded={expandedIds.has(endpoint.id)}
                params={getApiParams(endpoint.id)}
                onToggle={() => toggleExpand(endpoint.id)}
                onParamsChange={(params) => handleParamsChange(endpoint.id, params)}
                onSendRequest={() => handleSendRequest(endpoint)}
                onSaveParams={() => handleSaveParams(endpoint.id)}
                onLoadParams={() => handleLoadParams(endpoint.id)}
                loading={requestLoading === endpoint.id}
              />
            ))
          )}
        </div>

        <div className="lg:w-[400px] bg-slate-900/50 border border-white/10 rounded-xl flex flex-col overflow-hidden backdrop-blur-md">
          <div className="p-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">{t.response}</span>
            {lastResponse && (
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-bold ${lastResponse.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {lastResponse.statusCode}
                </span>
                <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <Clock size={10} /> {lastResponse.latency}ms
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300">
            {requestLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-2">
                <Loader2 size={32} className="animate-spin" />
                <span>Sending Request...</span>
              </div>
            ) : lastResponse ? (
              <div className="space-y-2">
                <div className="text-slate-500 text-[10px]">Endpoint: {lastResponse.endpoint}</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(lastResponse.data, null, 2)}</pre>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                <Search size={48} className="mb-4" />
                <p className="text-sm">{t.select_send}</p>
                <p className="text-xs mt-2">{t.view_response}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTester;
