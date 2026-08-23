import React, { useCallback, useState } from 'react';
import { Braces, ExternalLink, LoaderCircle, X } from 'lucide-react';
import { wfNewApi, type WfNewDailyReadingResourcePreviewSettings } from '../../api';
import { selectedDailyReadingWordGroupId } from './dailyReadingWordGroupStore';

interface Props {
  articleId: string;
  settings: WfNewDailyReadingResourcePreviewSettings;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WordNewDailyReadingResourcePreview: React.FC<Props> = ({
  articleId,
  settings,
  trans,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [json, setJson] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const preview = useCallback(async () => {
    const requestSettings: WfNewDailyReadingResourcePreviewSettings = {
      playbackMode: settings.playbackMode,
      wordMode: settings.wordMode,
      wordOrder: settings.wordOrder,
      newOnlyMaxReadCount: settings.newOnlyMaxReadCount,
      underlineCurrentSentence: settings.underlineCurrentSentence,
      bilingual: settings.bilingual,
      sentenceRate: settings.sentenceRate,
      wordRate: settings.wordRate,
      playbackPattern: settings.playbackPattern.map((step) => ({ ...step })),
    };

    setOpen(true);
    setLoading(true);
    setApiUrl('');
    setError(null);
    try {
      const result = await wfNewApi.previewDailyReadingResources(
        articleId,
        requestSettings,
        selectedDailyReadingWordGroupId(),
      );
      setJson(JSON.stringify(result.resource, null, 2));
      setApiUrl(result.apiUrl);
    } catch (previewError) {
      setJson('');
      setApiUrl('');
      setError(previewError instanceof Error
        ? previewError.message
        : trans('home.dailyReading.resourcePreviewFailed'));
    } finally {
      setLoading(false);
    }
  }, [articleId, settings, trans]);

  return (
    <>
      <button
        type="button"
        onClick={() => void preview()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/20 px-2 py-2 text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/10 transition-colors"
        title={trans('home.dailyReading.resourcePreview')}
      >
        <Braces className="h-4 w-4" />
        <span className="text-[10px] font-bold">
          {trans('home.dailyReading.resourcePreview')}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={trans('home.dailyReading.resourcePreviewTitle')}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-zinc-100">
                  {trans('home.dailyReading.resourcePreviewTitle')}
                </h3>
                <p className="truncate text-[10px] font-mono text-zinc-500">{articleId}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
                title={trans('home.dailyReading.closeResourcePreview')}
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            {!loading && !error && apiUrl && (
              <div className="border-b border-white/10 px-4 py-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  {trans('home.dailyReading.resourcePreviewApiUrl')}
                </p>
                <a
                  href={apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[10px] font-mono leading-relaxed text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/10"
                  title={trans('home.dailyReading.openResourcePreviewApiUrl')}
                >
                  <span className="min-w-0 flex-1 break-all">{apiUrl}</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
            )}
            <div className="min-h-48 flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-sky-300">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {trans('home.dailyReading.loadingResourcePreview')}
                </div>
              )}
              {!loading && error && <p className="text-xs text-rose-400">{error}</p>}
              {!loading && !error && (
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-emerald-300">
                  {json}
                </pre>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
