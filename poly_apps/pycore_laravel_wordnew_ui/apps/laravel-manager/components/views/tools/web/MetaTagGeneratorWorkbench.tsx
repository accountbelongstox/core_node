/** Meta tag generator: SEO form with live Google, X and Facebook previews and a copyable snippet. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, Eraser, ImageOff, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Field, Pane, Seg, Toggle, WEB_INPUT_CLASS, WebPage, lastInput, useDebounced, useToolRecord } from './kit/webKit';
import {
  DEFAULT_META_INPUT, DESCRIPTION_IDEAL_MAX, DESCRIPTION_IDEAL_MIN, TITLE_IDEAL_MAX, breadcrumbUrl, buildMetaTags, displayHost, isHttpUrl, truncateText,
  type MetaPageType, type MetaTagInput, type TwitterCardType,
} from './logic/metaTags';

type Preview = 'google' | 'mobile' | 'x' | 'facebook';

const PAGE_TYPES: MetaPageType[] = ['website', 'article', 'product'];
const CARDS: TwitterCardType[] = ['summary', 'summary_large_image'];
const DEBOUNCE_MS = 150;
const SAMPLE: Partial<MetaTagInput> = {
  title: 'core_node Tools - free developer utilities',
  description: 'Format JSON, decode JWTs, generate QR codes and more. Every tool runs in your browser, so your data never leaves the page.',
  url: 'https://example.com/tools',
  image: 'https://example.com/og-image.png',
  imageAlt: 'core_node tools overview',
  siteName: 'core_node',
  twitterSite: '@core_node',
};

const restore = (source: Record<string, unknown>): MetaTagInput => {
  const base: Record<string, unknown> = { ...DEFAULT_META_INPUT };
  Object.keys(DEFAULT_META_INPUT).forEach((key) => {
    if (typeof source[key] === typeof base[key]) base[key] = source[key];
  });
  return base as unknown as MetaTagInput;
};

const Meter: React.FC<{ length: number; min: number; max: number; warnMax: number }> = ({ length, min, max, warnMax }) => {
  const tone = length === 0 ? 'bg-slate-300 dark:bg-slate-600' : length > warnMax ? 'bg-rose-500' : length > max || length < min ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(100, (length / warnMax) * 100)}%` }} /></div>
      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{length}/{max}</span>
    </div>
  );
};

const CardImage: React.FC<{ src: string; className: string }> = ({ src, className }) => {
  const [failed, setFailed] = useState('');
  const usable = src && isHttpUrl(src) && failed !== src;
  return usable
    ? <img src={src} alt="" onError={() => setFailed(src)} className={`${className} object-cover`} />
    : <div className={`${className} flex items-center justify-center bg-slate-200 text-slate-400 dark:bg-slate-700`}><ImageOff className="h-8 w-8" aria-hidden /></div>;
};

const MetaTagGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [input, setInput] = useState<MetaTagInput>(() => restore(lastInput(lastRun)));
  const [preview, setPreview] = useState<Preview>('google');
  const value = useDebounced(input, DEBOUNCE_MS);
  const set = <K extends keyof MetaTagInput>(key: K, next: MetaTagInput[K]) => setInput((prev) => ({ ...prev, [key]: next }));

  const snippet = useMemo(() => buildMetaTags(value), [value]);
  const host = displayHost(value.url) || t('toolsWeb.meta.example_host');
  const title = value.title.trim() || t('toolsWeb.meta.placeholder_title');
  const description = value.description.trim() || t('toolsWeb.meta.placeholder_description');
  const recordRun = () => record({ ...input }, { tags: snippet.split('\n').length });
  const urlBad = !!input.url.trim() && !isHttpUrl(input.url.trim());
  const imageBad = !!input.image.trim() && !isHttpUrl(input.image.trim());
  const badClass = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/40';

  const text = (key: 'title' | 'description' | 'url' | 'image' | 'imageAlt' | 'siteName' | 'locale' | 'twitterSite' | 'author' | 'keywords' | 'themeColor', label: string, placeholder = '', bad = false) => (
    <Field label={label}>
      <input value={input[key]} onChange={(event) => set(key, event.target.value)} placeholder={placeholder} className={`${WEB_INPUT_CLASS} ${bad ? badClass : ''}`} />
    </Field>
  );

  return (
    <WebPage>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-3">
          <Pane
            title={t('toolsWeb.meta.section_basics')}
            actions={(
              <>
                <Btn icon={Wand2} onClick={() => setInput((prev) => ({ ...prev, ...SAMPLE }))}>{t('toolsWeb.common.sample')}</Btn>
                <Btn icon={Eraser} title={t('uiTools.common.clear')} onClick={() => setInput(DEFAULT_META_INPUT)} />
              </>
            )}
            bodyClassName="space-y-3 p-3"
          >
            <div>
              {text('title', t('toolsWeb.meta.title'), t('toolsWeb.meta.placeholder_title'))}
              <Meter length={input.title.length} min={10} max={TITLE_IDEAL_MAX} warnMax={TITLE_IDEAL_MAX + 20} />
            </div>
            <div>
              <Field label={t('toolsWeb.meta.description')}>
                <textarea rows={3} value={input.description} onChange={(event) => set('description', event.target.value)} placeholder={t('toolsWeb.meta.placeholder_description')} className={`${WEB_INPUT_CLASS} resize-y`} />
              </Field>
              <Meter length={input.description.length} min={DESCRIPTION_IDEAL_MIN} max={DESCRIPTION_IDEAL_MAX} warnMax={DESCRIPTION_IDEAL_MAX + 40} />
            </div>
            {text('url', t('toolsWeb.meta.url'), 'https://example.com/page', urlBad)}
            {urlBad && <p className="text-[11px] text-rose-500">{t('toolsWeb.meta.invalid_url')}</p>}
            <Toggle on={input.canonical} onChange={(next) => set('canonical', next)} label={t('toolsWeb.meta.canonical')} />
          </Pane>

          <Pane title={t('toolsWeb.meta.section_social')} bodyClassName="space-y-3 p-3">
            {text('image', t('toolsWeb.meta.image'), 'https://example.com/og.png', imageBad)}
            {imageBad && <p className="text-[11px] text-rose-500">{t('toolsWeb.meta.invalid_url')}</p>}
            {text('imageAlt', t('toolsWeb.meta.image_alt'))}
            {text('siteName', t('toolsWeb.meta.site_name'))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('toolsWeb.meta.page_type')}>
                <Seg value={input.type} onChange={(next) => set('type', next)} options={PAGE_TYPES.map((value) => ({ value, label: t(`toolsWeb.meta.type_${value}`) }))} />
              </Field>
              <Field label={t('toolsWeb.meta.twitter_card')}>
                <Seg value={input.twitterCard} onChange={(next) => set('twitterCard', next)} options={CARDS.map((value) => ({ value, label: t(`toolsWeb.meta.card_${value}`) }))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {text('twitterSite', t('toolsWeb.meta.twitter_site'), '@handle')}
              {text('locale', t('toolsWeb.meta.locale'), 'en_US')}
            </div>
          </Pane>

          <Pane title={t('toolsWeb.meta.section_advanced')} bodyClassName="space-y-3 p-3">
            {text('keywords', t('toolsWeb.meta.keywords'), t('toolsWeb.meta.keywords_placeholder'))}
            <div className="grid gap-3 sm:grid-cols-2">
              {text('author', t('toolsWeb.meta.author'))}
              <Field label={t('toolsWeb.meta.theme_color')}>
                <div className="flex gap-2">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(input.themeColor) ? input.themeColor : '#06b6d4'} onChange={(event) => set('themeColor', event.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5 dark:border-slate-700" aria-label={t('toolsWeb.meta.theme_color')} />
                  <input value={input.themeColor} onChange={(event) => set('themeColor', event.target.value)} placeholder="#06b6d4" className={WEB_INPUT_CLASS} />
                </div>
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Toggle on={input.robotsIndex} onChange={(next) => set('robotsIndex', next)} label={t('toolsWeb.meta.robots_index')} />
              <Toggle on={input.robotsFollow} onChange={(next) => set('robotsFollow', next)} label={t('toolsWeb.meta.robots_follow')} />
              <Toggle on={input.viewport} onChange={(next) => set('viewport', next)} label={t('toolsWeb.meta.viewport')} />
              <Toggle on={input.charset} onChange={(next) => set('charset', next)} label={t('toolsWeb.meta.charset')} />
            </div>
          </Pane>
        </div>

        <div className="min-w-0 space-y-3">
          <Pane
            title={t('toolsWeb.meta.preview')}
            actions={(
              <Seg value={preview} onChange={setPreview} options={[
                { value: 'google', label: t('toolsWeb.meta.preview_google') },
                { value: 'mobile', label: t('toolsWeb.meta.preview_mobile') },
                { value: 'x', label: 'X' },
                { value: 'facebook', label: t('toolsWeb.meta.preview_facebook') },
              ]} />
            )}
            bodyClassName="bg-slate-100 p-4 dark:bg-slate-950/40"
          >
            {(preview === 'google' || preview === 'mobile') && (
              <div className={`mx-auto rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 ${preview === 'mobile' ? 'max-w-[22rem]' : 'max-w-[40rem]'}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">{host.charAt(0)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-800 dark:text-slate-100">{value.siteName.trim() || host}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{breadcrumbUrl(value.url) || `https://${host}`}</div>
                  </div>
                </div>
                <h4 className={`mt-2 text-blue-700 dark:text-blue-400 ${preview === 'mobile' ? 'text-lg leading-6' : 'text-xl leading-7'}`}>{truncateText(title, TITLE_IDEAL_MAX)}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{truncateText(description, DESCRIPTION_IDEAL_MAX)}</p>
              </div>
            )}
            {preview === 'x' && (
              <div className="mx-auto max-w-[32rem] overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-black">
                {value.twitterCard === 'summary_large_image' && value.image ? (
                  <div className="relative">
                    <CardImage src={value.image} className="aspect-[2/1] w-full" />
                    <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/70 px-2 py-0.5 text-xs text-white">{truncateText(title, TITLE_IDEAL_MAX)}</span>
                  </div>
                ) : null}
                <div className={value.twitterCard === 'summary' || !value.image ? 'flex gap-3 p-3' : 'p-3'}>
                  {(value.twitterCard === 'summary' || !value.image) && <CardImage src={value.image} className="h-20 w-20 shrink-0 rounded-lg" />}
                  <div className="min-w-0">
                    <div className="truncate text-xs text-slate-500">{host}</div>
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{truncateText(title, TITLE_IDEAL_MAX)}</div>
                    <div className="line-clamp-2 text-xs text-slate-500">{truncateText(description, 125)}</div>
                  </div>
                </div>
              </div>
            )}
            {preview === 'facebook' && (
              <div className="mx-auto max-w-[32rem] overflow-hidden border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                <CardImage src={value.image} className="aspect-[1.91/1] w-full" />
                <div className="border-t border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="truncate text-[11px] uppercase tracking-wide text-slate-500">{host}</div>
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{truncateText(title, TITLE_IDEAL_MAX + 10)}</div>
                  <div className="line-clamp-2 text-xs text-slate-500">{truncateText(description, 120)}</div>
                </div>
              </div>
            )}
          </Pane>

          <Pane
            title={t('toolsWeb.meta.snippet')}
            icon={Code2}
            className="h-[40vh] min-h-[260px]"
            bodyClassName="flex flex-col"
            actions={<CopyBtn getText={() => snippet} onCopied={recordRun} />}
            footer={t('toolsWeb.common.lines', { count: snippet.split('\n').length })}
          >
            <CodeEditor value={snippet} readOnly language="html" className="min-h-0 flex-1" />
          </Pane>
        </div>
      </div>
    </WebPage>
  );
};

export default MetaTagGeneratorWorkbench;
