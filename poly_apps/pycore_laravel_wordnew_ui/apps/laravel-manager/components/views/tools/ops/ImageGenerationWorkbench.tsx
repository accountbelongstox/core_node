/** Image Generation: prompt studio with aspect-ratio tiles, provider readiness and a session gallery. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ImagePlus, Sparkles } from 'lucide-react';
import { callToolApi, ToolRunError, useToolRun } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, controlClass, EmptyBlock, Notice, OpsPage, OpsStatusBar, Panel, Spinner } from './opsKit';
import { useRemote } from './opsHooks';
import { downloadUrl, mimeExtension } from './opsLogic';
import type { AiCatalogData, AiImageData } from './opsTypes';

interface ImageInput {
  prompt: string;
  size: string;
}

interface GeneratedImage extends ImageInput {
  id: number;
  dataUri: string;
  provider: string;
  model: string;
  latencyMs: number | null;
  mime: string;
}

const PROMPT_MAX = 2000;
const GALLERY_LIMIT = 12;
const SOURCE = 'laravel-manager-tools';
const RATIOS: Array<{ id: string; width: number; height: number }> = [
  { id: '1:1', width: 20, height: 20 },
  { id: '16:9', width: 28, height: 16 },
  { id: '9:16', width: 16, height: 28 },
  { id: '4:3', width: 24, height: 18 },
];

const ImageGenerationWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const previous = lastRun?.input as Partial<ImageInput> | null | undefined;
  const [prompt, setPrompt] = useState(previous?.prompt ?? '');
  const [size, setSize] = useState(previous?.size ?? '1:1');
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const { error, running, run } = useToolRun<GeneratedImage>(tool.id, variant);
  const catalog = useRemote(() => callToolApi<AiCatalogData>('aiManagement.getCatalog'), []);
  const ready = (catalog.data?.providers ?? []).filter((provider) => provider.image && provider.configured);
  const active = gallery.find((image) => image.id === activeId) ?? gallery[0] ?? null;

  const generate = async (): Promise<void> => {
    const input: ImageInput = { prompt: prompt.trim(), size };
    if (!input.prompt || running) return;
    const created = await run(input, async () => {
      const data = await callToolApi<AiImageData>('aiManagement.image', { ...input, source: SOURCE });
      if (!data?.success || !data.image_base64) throw new ToolRunError('remote_failed', { message: data?.error ?? '' });
      const mime = data.mime || 'image/png';
      return { ...input, id: Date.now(), dataUri: `data:${mime};base64,${data.image_base64}`, provider: data.provider, model: data.model, latencyMs: data.latency_ms, mime };
    });
    if (created) {
      setGallery((items) => [created, ...items].slice(0, GALLERY_LIMIT));
      setActiveId(created.id);
    }
  };

  return (
    <OpsPage>
      <OpsStatusBar accent="fuchsia" mode="server" updatedAt={catalog.updatedAt} loading={catalog.loading} onRefresh={() => void catalog.reload()}>
        {catalog.loading ? t('toolsOps.common.loading')
          : ready.length > 0 ? t('toolsOps.image.providers_ready', { count: ready.length, names: ready.map((provider) => provider.name).join(', ') })
            : t('toolsOps.image.no_provider')}
      </OpsStatusBar>
      {catalog.error && <Notice tone="warn">{catalog.error}</Notice>}
      {!catalog.loading && !catalog.error && ready.length === 0 && <Notice tone="warn">{t('toolsOps.image.no_provider_hint')}</Notice>}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title={t('toolsOps.image.prompt')} icon={Sparkles} accent="fuchsia" className="lg:col-span-2">
          <div className="space-y-4">
            <div>
              <textarea
                value={prompt}
                maxLength={PROMPT_MAX}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void generate(); }}
                rows={8}
                placeholder={t('toolsOps.image.prompt_placeholder')}
                className={`${controlClass('fuchsia')} resize-y`}
              />
              <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">{prompt.length} / {PROMPT_MAX}</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('toolsOps.image.ratio')}</p>
              <div className="flex flex-wrap gap-2">
                {RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    type="button"
                    onClick={() => setSize(ratio.id)}
                    aria-pressed={size === ratio.id}
                    className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                      size === ratio.id ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/50 dark:bg-fuchsia-500/10 dark:text-fuchsia-300' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="rounded-sm border-2 border-current" style={{ width: ratio.width, height: ratio.height }} />
                    {ratio.id}
                  </button>
                ))}
              </div>
            </div>
            <Btn variant="primary" accent="fuchsia" icon={ImagePlus} loading={running} onClick={() => void generate()} disabled={!prompt.trim()} className="w-full">
              {running ? t('toolsOps.image.generating') : t('toolsOps.image.generate')}
            </Btn>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Panel>

        <Panel
          title={t('toolsOps.image.canvas')}
          icon={ImagePlus}
          accent="fuchsia"
          className="lg:col-span-3"
          actions={active ? <Btn size="sm" icon={Download} onClick={() => void downloadUrl(active.dataUri, `ai-image-${active.id}.${mimeExtension(active.mime)}`)}>{t('uiTools.common.download')}</Btn> : undefined}
        >
          {running ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 text-sm text-slate-400"><Spinner className="h-7 w-7" />{t('toolsOps.image.generating')}</div>
          ) : active ? (
            <div className="space-y-3">
              <img src={active.dataUri} alt={active.prompt.slice(0, 120)} className="mx-auto max-h-[28rem] w-auto max-w-full rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-white/10" />
              <p className="text-center text-[11px] text-slate-400">{active.provider}{active.model ? ` / ${active.model}` : ''}{active.latencyMs !== null ? ` · ${Math.round(active.latencyMs)} ms` : ''} · {active.size}</p>
            </div>
          ) : (
            <EmptyBlock icon={ImagePlus} className="min-h-[20rem]">{t('toolsOps.image.empty')}</EmptyBlock>
          )}
          {gallery.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((image) => (
                <button key={image.id} type="button" onClick={() => setActiveId(image.id)} title={image.prompt} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${image.id === active?.id ? 'ring-fuchsia-500' : 'ring-transparent'}`}>
                  <img src={image.dataUri} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </OpsPage>
  );
};

export default ImageGenerationWorkbench;
