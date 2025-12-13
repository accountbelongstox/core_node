import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';

interface SystemInitPanelProps {
  onComplete: () => void;
}

const SystemInitPanel: React.FC<SystemInitPanelProps> = ({ onComplete }) => {
  const [initStatus, setInitStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const [statusRes, statsRes] = await Promise.all([
        apiService.appQyV1InitializationStatus(),
        apiService.appQyV1DictionaryStatistics()
      ]);

      if (statusRes.success && statusRes.data) {
        setInitStatus(statusRes.data);
        if (statusRes.data.initialized) {
          onComplete();
        }
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check system status');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    setInitializing(true);
    setError(null);

    try {
      const response = await apiService.appQyV1SystemInitialize();
      if (response.success) {
        await checkStatus();
      } else {
        setError(response.error || 'Initialization failed');
      }
    } catch (err: any) {
      setError(err.message || 'Initialization error');
    } finally {
      setInitializing(false);
    }
  };

  if (loading) {
    return (
      <div className={`${commonClasses.card} p-8 flex flex-col items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-500">Checking system status...</p>
      </div>
    );
  }

  return (
    <div className={`${commonClasses.card} p-6`}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4">
          {initStatus?.initialized ? (
            <CheckCircle className="w-8 h-8 text-green-600" />
          ) : (
            <Play className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {initStatus?.initialized ? 'System Ready' : 'Initialize Vocabulary System'}
        </h2>
        <p className="text-sm text-slate-500">
          {initStatus?.initialized
            ? 'Your vocabulary learning system is ready to use.'
            : 'Set up your vocabulary database for the first time.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">{error}</div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-indigo-600">{stats.total_words || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Total Words</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-green-600">{stats.total_libraries || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Libraries</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-purple-600">{stats.supported_languages || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Languages</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-orange-600">{stats.total_collections || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Collections</div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {!initStatus?.initialized && (
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
          >
            {initializing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing System...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Initialize System
              </>
            )}
          </button>
        )}
        <button
          onClick={checkStatus}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {initStatus?.initialized && (
        <button
          onClick={onComplete}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} w-full mt-4`}
        >
          Continue to Learning
        </button>
      )}
    </div>
  );
};

export default SystemInitPanel;
