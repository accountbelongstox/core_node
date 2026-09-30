/** 1280x720 live preview image of the video look being edited. */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { VocabBanner } from '../vocabulary/vocabShared';
import { ORCH_L } from './orchShared';
import type { OrchVideoPreviewState } from './useOrchVideoPreview';

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;

const OrchVideoPreview: React.FC<{ preview: OrchVideoPreviewState }> = ({ preview }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-slate-300">{ORCH_L.videoPreviewTitle} ({PREVIEW_WIDTH}×{PREVIEW_HEIGHT})</p>
      {preview.loading && (
        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300">
          <Loader2 className="w-3 h-3 animate-spin" /> {ORCH_L.videoPreviewLoading}
        </span>
      )}
    </div>
    <div
      className="relative w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60"
      style={{ aspectRatio: `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}` }}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={ORCH_L.videoPreviewTitle}
          className={`h-full w-full object-contain transition-opacity ${preview.loading ? 'opacity-60' : 'opacity-100'}`}
        />
      )}
    </div>
    <p className="text-[10px] text-slate-500">{ORCH_L.videoPreviewNote} {ORCH_L.videoResolution}</p>
    {preview.error && <VocabBanner kind="error" message={preview.error} />}
  </div>
);

export default OrchVideoPreview;
