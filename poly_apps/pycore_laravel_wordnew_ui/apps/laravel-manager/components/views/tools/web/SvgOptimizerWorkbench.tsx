/** SVG optimizer: option toggles, live before / after comparison and byte savings. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, Eraser, FileImage, Upload, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CHECKER_STYLE, CodeEditor, CopyBtn, Metric, Notice, Pane, Seg, Slider, Toggle, WebPage, downloadText, formatBytes, gzipSize, lastInput, pickString, useDebounced, useToolRecord, utf8Length } from './kit/webKit';
import { DEFAULT_SVG_OPTIONS, optimizeSvg, svgDataUri, type SvgOptimizeOptions } from './logic/svg';

type Background = 'checker' | 'light' | 'dark';
type Compare = 'side' | 'swipe';
type BooleanOption = Exclude<keyof SvgOptimizeOptions, 'precision'>;

const DEBOUNCE_MS = 200;
const OPTION_KEYS: BooleanOption[] = [
  'removeComments', 'removeMetadata', 'removeEditorData', 'removeTitleDesc', 'removeScripts', 'removeEmpty', 'collapseGroups', 'removeUnusedIds', 'shortenColors', 'removeDeclaration', 'removeDimensions',
];
const BACKGROUND_STYLE: Record<Background, React.CSSProperties> = {
  checker: CHECKER_STYLE,
  light: { backgroundColor: '#ffffff' },
  dark: { backgroundColor: '#0f172a' },
};
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Generator: Inkscape 1.3 -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="120.000" height="120.000" viewBox="0 0 120.000 120.000" version="1.1">
  <sodipodi:namedview id="base" inkscape:zoom="1.0"/>
  <metadata id="metadata1"><title>icon</title></metadata>
  <defs id="defs1"><linearGradient id="grad"><stop offset="0.000000" stop-color="#06B6D4"/><stop offset="1.000000" stop-color="#3B82F6"/></linearGradient></defs>
  <g id="layer1" inkscape:label="Layer 1">
    <g>
      <circle id="c1" cx="60.000000" cy="60.000000" r="48.123456" fill="url(#grad)" stroke="#FFFFFF" stroke-width="4.000000" opacity="1"/>
      <path id="p1" d="M 38.500000,62.250000 L 54.000000,77.750000 L 83.250000,44.000000" fill="none" stroke="#ffffff" stroke-width="8.000000" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>
`;

const SvgOptimizerWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [input, setInput] = useState(pickString(prefill, 'svg', ''));
  const [options, setOptions] = useState<SvgOptimizeOptions>(DEFAULT_SVG_OPTIONS);
  const [background, setBackground] = useState<Background>('checker');
  const [compare, setCompare] = useState<Compare>('side');
  const [split, setSplit] = useState(50);
  const [gzip, setGzip] = useState<{ before: number | null; after: number | null } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const source = useDebounced(input, DEBOUNCE_MS);

  const result = useMemo(() => (source.trim() ? optimizeSvg(source, options) : null), [source, options]);
  const output = result?.ok ? result.output : '';
  const before = utf8Length(source);
  const after = utf8Length(output);
  const saved = before && output ? Math.round(((before - after) / before) * 1000) / 10 : 0;
  const recordRun = () => record({ svg: input, precision: options.precision }, { before, after });

  useEffect(() => {
    if (!output) { setGzip(null); return undefined; }
    let cancelled = false;
    void Promise.all([gzipSize(source), gzipSize(output)]).then(([b, a]) => { if (!cancelled) setGzip({ before: b, after: a }); });
    return () => { cancelled = true; };
  }, [source, output]);

  const readFile = async (file: File) => setInput(await file.text());
  const setFlag = (key: BooleanOption, value: boolean) => setOptions((prev) => ({ ...prev, [key]: value }));
  const error = result && result.ok === false ? result : null;
  const beforeUri = useMemo(() => (error || !source.trim() ? '' : svgDataUri(source)), [source, error]);
  const afterUri = useMemo(() => (output ? svgDataUri(output) : ''), [output]);

  const picture = (uri: string, label: string) => (
    <figure className="min-w-0">
      <div className="mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" style={BACKGROUND_STYLE[background]}>
        {uri && <img src={uri} alt={label} className="h-full w-full object-contain p-3" />}
      </div>
      <figcaption className="mt-1 text-center font-mono text-[11px] uppercase tracking-wider text-slate-500">{label}</figcaption>
    </figure>
  );

  return (
    <WebPage>
      <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ''; }} />
      <Pane
        title={t('toolsWeb.svg.options')}
        bodyClassName="space-y-4 p-3"
        actions={<Btn onClick={() => setOptions(DEFAULT_SVG_OPTIONS)}>{t('toolsWeb.svg.reset')}</Btn>}
      >
        <div className="max-w-sm">
          <Slider value={options.precision} min={1} max={5} onChange={(precision) => setOptions((prev) => ({ ...prev, precision }))} label={t('toolsWeb.svg.precision')} format={(value) => t('toolsWeb.svg.decimals', { count: value })} />
        </div>
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {OPTION_KEYS.map((key) => <Toggle key={key} on={options[key]} onChange={(value) => setFlag(key, value)} label={t(`toolsWeb.svg.opt_${key}`)} />)}
        </div>
      </Pane>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.svg.input')}
          icon={FileImage}
          className="h-[40vh] min-h-[240px]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Upload} onClick={() => fileRef.current?.click()}>{t('toolsWeb.svg.upload')}</Btn>
              <Btn icon={Wand2} onClick={() => setInput(SAMPLE)}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!input} onClick={() => setInput('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={formatBytes(utf8Length(input))}
        >
          <CodeEditor value={input} onChange={setInput} language="xml" placeholder={t('toolsWeb.svg.placeholder')} className="min-h-0 flex-1" />
        </Pane>
        <Pane
          title={t('toolsWeb.svg.output')}
          icon={FileImage}
          className="h-[40vh] min-h-[240px]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <CopyBtn getText={() => output} onCopied={recordRun} disabled={!output} />
              <CopyBtn getText={() => `url("${svgDataUri(output)}")`} label={t('toolsWeb.svg.copy_data_uri')} disabled={!output} onCopied={recordRun} />
              <Btn icon={Download} title={t('uiTools.common.download')} disabled={!output} onClick={() => { downloadText(output, 'optimized.svg', 'image/svg+xml'); recordRun(); }} />
            </>
          )}
          footer={formatBytes(after)}
        >
          <CodeEditor value={output} readOnly language="xml" className="min-h-0 flex-1" />
        </Pane>
      </div>

      {error && <Notice tone="error" icon={AlertTriangle}>{error.code === 'not_svg' ? t('toolsWeb.svg.errors.not_svg', { root: error.message }) : t('toolsWeb.svg.errors.invalid', { message: error.message })}</Notice>}

      {output && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label={t('toolsWeb.svg.stat_before')} value={formatBytes(before)} />
            <Metric label={t('toolsWeb.svg.stat_after')} value={formatBytes(after)} tone="text-cyan-600 dark:text-cyan-300" />
            <Metric label={t('toolsWeb.svg.stat_saved')} value={`${saved}%`} tone={saved > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
            <Metric label={t('toolsWeb.svg.stat_gzip')} value={gzip?.before != null && gzip.after != null ? `${formatBytes(gzip.before)} → ${formatBytes(gzip.after)}` : '-'} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={t('toolsWeb.svg.stat_saved')}>
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, 100 - (after / Math.max(before, 1)) * 100))}%` }} />
          </div>

          <Pane
            title={t('toolsWeb.svg.compare')}
            actions={(
              <>
                <Seg value={compare} onChange={setCompare} options={[{ value: 'side', label: t('toolsWeb.svg.compare_side') }, { value: 'swipe', label: t('toolsWeb.svg.compare_swipe') }]} />
                <Seg value={background} onChange={setBackground} options={[{ value: 'checker', label: t('toolsWeb.svg.bg_checker') }, { value: 'light', label: t('toolsWeb.svg.bg_light') }, { value: 'dark', label: t('toolsWeb.svg.bg_dark') }]} />
              </>
            )}
            bodyClassName="p-3"
          >
            {compare === 'side' ? (
              <div className="grid gap-3 sm:grid-cols-2">{picture(beforeUri, t('toolsWeb.svg.before'))}{picture(afterUri, t('toolsWeb.svg.after'))}</div>
            ) : (
              <div className="mx-auto max-w-md space-y-2">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" style={BACKGROUND_STYLE[background]}>
                  <img src={afterUri} alt={t('toolsWeb.svg.after')} className="absolute inset-0 h-full w-full object-contain p-3" />
                  <img src={beforeUri} alt={t('toolsWeb.svg.before')} className="absolute inset-0 h-full w-full object-contain p-3" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-500" style={{ left: `${split}%` }} />
                </div>
                <Slider value={split} min={0} max={100} onChange={setSplit} label={`${t('toolsWeb.svg.before')} / ${t('toolsWeb.svg.after')}`} format={(value) => `${value}%`} />
              </div>
            )}
          </Pane>
        </>
      )}
    </WebPage>
  );
};

export default SvgOptimizerWorkbench;
