/** HTTP status reference: searchable class-banded grid with a detail panel. */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CopyBtn, WEB_INPUT_CLASS, WebPage, lastInput, pickNumber, useToolRecord } from './kit/webKit';
import { HTTP_STATUSES, STATUS_CLASSES, findStatus, statusClassOf, type HttpStatusInfo, type StatusClass } from './logic/httpStatus';

const BAND: Record<StatusClass, { bar: string; text: string; soft: string; ring: string }> = {
  1: { bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-300', soft: 'bg-sky-500/10', ring: 'ring-sky-500' },
  2: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', soft: 'bg-emerald-500/10', ring: 'ring-emerald-500' },
  3: { bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-300', soft: 'bg-indigo-500/10', ring: 'ring-indigo-500' },
  4: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', soft: 'bg-amber-500/10', ring: 'ring-amber-500' },
  5: { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300', soft: 'bg-rose-500/10', ring: 'ring-rose-500' },
};
const MIN_CODE = 100;
const MAX_CODE = 599;
const DEFAULT_CODE = 404;

const HttpStatusLookupWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [query, setQuery] = useState('');
  const [band, setBand] = useState<StatusClass | 0>(0);
  const [selected, setSelected] = useState<number>(pickNumber(prefill, 'code', DEFAULT_CODE));
  const panelRef = useRef<HTMLDivElement | null>(null);

  const nameOf = (code: number): string => t(`toolsWeb.httpStatus.codes.${code}.name`, { defaultValue: t('toolsWeb.httpStatus.unassigned_name') });
  const descOf = (code: number): string => t(`toolsWeb.httpStatus.codes.${code}.desc`, { defaultValue: t('toolsWeb.httpStatus.unassigned_desc') });

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => HTTP_STATUSES.filter((status) => {
    if (band && statusClassOf(status.code) !== band) return false;
    if (!trimmed) return true;
    return String(status.code).startsWith(trimmed)
      || t(`toolsWeb.httpStatus.codes.${status.code}.name`).toLowerCase().includes(trimmed)
      || t(`toolsWeb.httpStatus.codes.${status.code}.desc`).toLowerCase().includes(trimmed);
  }), [trimmed, band, t]);
  const numeric = /^\d{3}$/.test(trimmed) ? Number(trimmed) : null;
  const unknownCode = numeric !== null && numeric >= MIN_CODE && numeric <= MAX_CODE && !findStatus(numeric) && (!band || statusClassOf(numeric) === band) ? numeric : null;

  const info: HttpStatusInfo | undefined = findStatus(selected);
  const selectedClass = statusClassOf(selected);
  const index = HTTP_STATUSES.findIndex((status) => status.code === selected);

  const select = (code: number) => {
    setSelected(code);
    record({ code }, { code, name: nameOf(code) });
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const step = (delta: number) => {
    const target = HTTP_STATUSES[index + delta];
    if (target) select(target.code);
  };
  const yesNo = (value: boolean) => t(value ? 'toolsWeb.httpStatus.yes' : 'toolsWeb.httpStatus.no');

  const card = (code: number, label: string) => {
    const style = BAND[statusClassOf(code)];
    return (
      <button
        key={code}
        type="button"
        onClick={() => select(code)}
        aria-pressed={selected === code}
        className={`group flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 ${selected === code ? `ring-2 ${style.ring}` : ''}`}
      >
        <span className={`w-1 self-stretch ${style.bar}`} />
        <span className={`py-2 font-mono text-xl font-black ${style.text}`}>{code}</span>
        <span className="min-w-0 flex-1 truncate py-2 pr-3 text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
      </button>
    );
  };

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('toolsWeb.httpStatus.search_placeholder')} aria-label={t('toolsWeb.httpStatus.search_placeholder')} className={`${WEB_INPUT_CLASS} pl-9 pr-8`} />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600" aria-label={t('uiTools.common.clear')}><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('toolsWeb.httpStatus.class')}>
          <button type="button" role="radio" aria-checked={band === 0} onClick={() => setBand(0)} className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${band === 0 ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{t('toolsWeb.httpStatus.all')}</button>
          {STATUS_CLASSES.map((cls) => (
            <button key={cls} type="button" role="radio" aria-checked={band === cls} onClick={() => setBand(band === cls ? 0 : cls)} className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-colors ${band === cls ? `${BAND[cls].bar} border-transparent text-white` : `border-slate-300 dark:border-slate-700 ${BAND[cls].text}`}`}>{cls}xx</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-5">
          {unknownCode !== null && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{card(unknownCode, t('toolsWeb.httpStatus.unassigned_name'))}</div>}
          {STATUS_CLASSES.map((cls) => {
            const rows = matches.filter((status) => statusClassOf(status.code) === cls);
            if (!rows.length) return null;
            return (
              <section key={cls}>
                <h3 className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${BAND[cls].bar}`} />
                  <span className={`font-mono text-sm font-black ${BAND[cls].text}`}>{cls}xx</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t(`toolsWeb.httpStatus.class_${cls}`)}</span>
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map((status) => card(status.code, nameOf(status.code)))}</div>
              </section>
            );
          })}
          {!matches.length && unknownCode === null && <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t('toolsWeb.httpStatus.no_match')}</p>}
        </div>

        <aside ref={panelRef} className="order-first lg:order-none">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:sticky lg:top-3">
            <div className={`${BAND[selectedClass].soft} px-4 py-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-mono text-5xl font-black leading-none ${BAND[selectedClass].text}`}>{selected}</div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{nameOf(selected)}</h3>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`toolsWeb.httpStatus.class_${selectedClass}`)}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Btn icon={ArrowLeft} title={t('toolsWeb.httpStatus.previous')} onClick={() => step(-1)} disabled={index <= 0} />
                  <Btn icon={ArrowRight} title={t('toolsWeb.httpStatus.next')} onClick={() => step(1)} disabled={index < 0 || index >= HTTP_STATUSES.length - 1} />
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="leading-6">{info ? descOf(selected) : t('toolsWeb.httpStatus.unassigned_desc')}</p>
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t(`toolsWeb.httpStatus.class_desc_${selectedClass}`)}</p>
              {info && (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><dt className="font-mono text-[10px] uppercase text-slate-500">{t('toolsWeb.httpStatus.cacheable')}</dt><dd className="mt-0.5 font-bold">{yesNo(info.cacheable)}</dd></div>
                  <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><dt className="font-mono text-[10px] uppercase text-slate-500">{t('toolsWeb.httpStatus.retry')}</dt><dd className="mt-0.5 flex items-center gap-1 font-bold"><RefreshCw className="h-3 w-3" aria-hidden />{yesNo(info.retry)}</dd></div>
                </dl>
              )}
              {info && info.headers.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{t('toolsWeb.httpStatus.headers')}</p>
                  <div className="flex flex-wrap gap-1.5">{info.headers.map((header) => <span key={header} className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-700 dark:text-cyan-300">{header}</span>)}</div>
                </div>
              )}
              {info?.deprecated && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{t('toolsWeb.httpStatus.deprecated')}</p>}
              <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
                <CopyBtn getText={() => `HTTP/1.1 ${selected} ${nameOf(selected)}`} label={t('toolsWeb.httpStatus.copy_line')} />
                <CopyBtn getText={() => String(selected)} label={t('toolsWeb.httpStatus.copy_code')} />
                <a href={`https://developer.mozilla.org/docs/Web/HTTP/Status/${selected}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" aria-hidden />MDN</a>
                {info && <a href={`https://www.rfc-editor.org/rfc/rfc${info.rfc}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" aria-hidden />RFC {info.rfc}</a>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </WebPage>
  );
};

export default HttpStatusLookupWorkbench;
