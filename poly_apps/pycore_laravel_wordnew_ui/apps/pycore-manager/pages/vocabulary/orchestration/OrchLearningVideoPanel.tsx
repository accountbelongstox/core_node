/**
 * Learning-video generation panel for the audio-orchestration tab.
 *
 * This feature moved here from the agent-history page: it reuses the SAME
 * backend config (agent_history_article video_* keys via the shared runtime
 * store) and the SAME video-jobs log panel — no duplicated state or logic.
 * Videos render from uploaded article records with the selected user's
 * playback settings, independent of the qwen TTS tasks.
 */
import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  persistAgentHistoryArticleConfig,
  useAgentHistoryRuntime,
} from '@/apps/pycore-manager/api';
import PcAgentHistoryVideoLogPanel from '../../agent-history/PcAgentHistoryVideoLogPanel';
import { ORCH_L } from './orchShared';

const OrchLearningVideoPanel: React.FC = () => {
  const { t } = useTranslation('pc');
  const tk = (key: string): string => t(`agentHistory.${key}`);
  const { articleConfig } = useAgentHistoryRuntime();
  const [busy, setBusy] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoUsername, setVideoUsername] = useState('');
  const [videoBatchName, setVideoBatchName] = useState('default');
  const [videoConcurrency, setVideoConcurrency] = useState(2);

  useEffect(() => {
    if (!articleConfig) return;
    setVideoEnabled(Boolean(articleConfig.video_enabled));
    setVideoUsername(String(articleConfig.video_username || ''));
    setVideoBatchName(String(articleConfig.video_batch_name || 'default'));
    setVideoConcurrency(Math.max(1, Math.min(4, Number(articleConfig.video_concurrency || 2))));
  }, [articleConfig]);

  const persist = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      await persistAgentHistoryArticleConfig(patch);
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-600 bg-slate-950/60 text-sm text-slate-200';

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Film className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.videoTitle}</h3>
        <button
          type="button"
          role="switch"
          aria-checked={videoEnabled}
          disabled={busy}
          onClick={() => {
            const next = !videoEnabled;
            setVideoEnabled(next);
            void persist({ video_enabled: next });
          }}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${videoEnabled ? 'bg-sky-600' : 'bg-slate-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${videoEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-slate-200">{tk('videoGeneration')}</span>
        <span className="text-[11px] text-slate-500">{tk('videoGenerationHint')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-slate-400">
          {tk('videoUsername')}
          <input
            value={videoUsername}
            onChange={(event) => setVideoUsername(event.target.value)}
            onBlur={(event) => void persist({ video_username: event.currentTarget.value.trim() })}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-slate-400">
          {tk('videoBatchName')}
          <input
            value={videoBatchName}
            onChange={(event) => setVideoBatchName(event.target.value)}
            onBlur={(event) => void persist({ video_batch_name: event.currentTarget.value.trim() || 'default' })}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-slate-400">
          {tk('videoConcurrency')}
          <input
            type="number"
            min={1}
            max={4}
            value={videoConcurrency}
            onChange={(event) => setVideoConcurrency(Math.max(1, Math.min(4, Number(event.target.value) || 2)))}
            onBlur={(event) => void persist({ video_concurrency: Math.max(1, Math.min(4, Number(event.currentTarget.value) || 2)) })}
            className={inputCls}
          />
        </label>
      </div>
      {videoEnabled && <PcAgentHistoryVideoLogPanel tk={tk} />}
      {!videoEnabled && (
        <p className="text-[11px] text-slate-500">{ORCH_L.videoOff}</p>
      )}
    </section>
  );
};

export default OrchLearningVideoPanel;
