/** MIME type lookup: instant filter by extension or type, grouped views and a file signature check. */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, Search, Upload, X } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyBtn, Pane, Seg, WEB_INPUT_CLASS, WebPage, formatBytes, lastInput, pickString, useToolRecord } from './kit/webKit';
import { MIME_ENTRIES, MIME_GROUPS, groupByMime, sniffMime, type MimeEntry, type MimeGroup } from './logic/mime';

type View = 'extension' | 'type';

const GROUP_STYLE: Record<MimeGroup, string> = {
  text: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  image: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  audio: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  video: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  font: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  document: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  archive: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  data: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  code: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  binary: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};
const SNIFF_BYTES = 64;

const extensionOf = (name: string): string => (name.includes('.') ? (name.split('.').pop() as string).toLowerCase() : '');

interface FileCheck {
  name: string;
  size: number;
  browserType: string;
  extensionType: string | null;
  sniffed: string | null;
}

const MimeTypeLookupWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [view, setView] = useState<View>(variant === 'mimeTypesLookup' ? 'type' : 'extension');
  const [query, setQuery] = useState(pickString(prefill, 'search', ''));
  const [group, setGroup] = useState<MimeGroup | 'all'>('all');
  const [selected, setSelected] = useState<MimeEntry | null>(null);
  const [check, setCheck] = useState<FileCheck | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const needle = query.trim().toLowerCase().replace(/^\./, '');
  const entries = useMemo(() => MIME_ENTRIES.filter((entry) => (group === 'all' || entry.group === group)
    && (!needle || entry.ext.includes(needle) || entry.mime.includes(needle))), [needle, group]);
  const sortedEntries = useMemo(() => {
    const exact = needle ? entries.filter((entry) => entry.ext === needle) : [];
    return [...exact, ...entries.filter((entry) => !exact.includes(entry))];
  }, [entries, needle]);
  const typeGroups = useMemo(() => groupByMime(entries), [entries]);

  const pick = (entry: MimeEntry) => {
    setSelected(entry);
    record({ search: entry.ext }, { mime: entry.mime });
  };
  const inspectFile = async (file: File) => {
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const ext = extensionOf(file.name);
    setCheck({ name: file.name, size: file.size, browserType: file.type, extensionType: MIME_ENTRIES.find((entry) => entry.ext === ext)?.mime ?? null, sniffed: sniffMime(head) });
  };
  const contentType = (entry: MimeEntry) => `Content-Type: ${entry.mime}${entry.mime.startsWith('text/') ? '; charset=utf-8' : ''}`;
  const verdict = check ? (check.sniffed && check.extensionType && check.sniffed !== check.extensionType && !(check.sniffed === 'application/zip' && /officedocument|epub|java-archive|android/.test(check.extensionType)) && !(check.sniffed === 'text/plain') ? 'mismatch' : 'ok') : null;

  const groupChip = (value: MimeGroup | 'all') => (
    <button key={value} type="button" onClick={() => setGroup(value)} aria-pressed={group === value} className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${group === value ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300 text-slate-600 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-300'}`}>
      {t(`toolsWeb.mime.group_${value}`)}
    </button>
  );

  return (
    <WebPage>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={view} onChange={setView} ariaLabel={t('toolsWeb.mime.view')} options={[
          { value: 'extension', label: t('toolsWeb.mime.by_extension') },
          { value: 'type', label: t('toolsWeb.mime.by_type') },
        ]} />
        <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('toolsWeb.mime.search_placeholder')} aria-label={t('toolsWeb.mime.search_placeholder')} spellCheck={false} className={`${WEB_INPUT_CLASS} pl-9 pr-8 font-mono`} />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600" aria-label={t('uiTools.common.clear')}><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">{groupChip('all')}{MIME_GROUPS.map(groupChip)}</div>

      {selected && (
        <Pane title={`.${selected.ext}`} icon={FileSearch} actions={<button type="button" onClick={() => setSelected(null)} className="cursor-pointer text-slate-400 hover:text-slate-600" aria-label={t('toolsWeb.mime.close')}><X className="h-3.5 w-3.5" /></button>} bodyClassName="grid gap-2 p-3 sm:grid-cols-2">
          {[
            { label: t('toolsWeb.mime.mime_type'), value: selected.mime },
            { label: t('toolsWeb.mime.content_type'), value: contentType(selected) },
            { label: t('toolsWeb.mime.accept_attr'), value: `<input type="file" accept=".${selected.ext},${selected.mime}">` },
            { label: t('toolsWeb.mime.nginx'), value: `types { ${selected.mime} ${selected.ext}; }` },
          ].map((row) => (
            <div key={row.label} className="min-w-0 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between gap-2"><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{row.label}</span><CopyBtn getText={() => row.value} /></div>
              <code className="block break-all font-mono text-xs text-slate-800 dark:text-slate-200">{row.value}</code>
            </div>
          ))}
        </Pane>
      )}

      <Pane title={t(view === 'extension' ? 'toolsWeb.mime.table_extensions' : 'toolsWeb.mime.table_types', { count: view === 'extension' ? sortedEntries.length : typeGroups.length })} bodyClassName="max-h-[56vh] overflow-auto">
        {view === 'extension' ? (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-900">
              <tr><th className="px-3 py-2">{t('toolsWeb.mime.extension')}</th><th className="px-3 py-2">{t('toolsWeb.mime.mime_type')}</th><th className="hidden px-3 py-2 sm:table-cell">{t('toolsWeb.mime.group')}</th><th className="w-10 px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedEntries.map((entry) => (
                <tr key={entry.ext} onClick={() => pick(entry)} className={`cursor-pointer hover:bg-cyan-500/5 ${selected?.ext === entry.ext ? 'bg-cyan-500/10' : ''}`}>
                  <td className="px-3 py-1.5 font-mono font-bold text-cyan-700 dark:text-cyan-300">.{entry.ext}</td>
                  <td className="break-all px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">{entry.mime}</td>
                  <td className="hidden px-3 py-1.5 sm:table-cell"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${GROUP_STYLE[entry.group]}`}>{t(`toolsWeb.mime.group_${entry.group}`)}</span></td>
                  <td className="px-2 py-1" onClick={(event) => event.stopPropagation()}><CopyBtn getText={() => entry.mime} label="" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {typeGroups.map((item) => (
              <li key={item.mime} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${GROUP_STYLE[item.group]}`}>{t(`toolsWeb.mime.group_${item.group}`)}</span>
                <code className="min-w-0 break-all font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{item.mime}</code>
                <span className="flex flex-wrap gap-1">
                  {item.extensions.map((ext) => (
                    <button key={ext} type="button" onClick={() => pick({ ext, mime: item.mime, group: item.group })} className="cursor-pointer rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300">.{ext}</button>
                  ))}
                </span>
                <span className="ml-auto"><CopyBtn getText={() => item.mime} label="" /></span>
              </li>
            ))}
          </ul>
        )}
        {!entries.length && <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">{t('toolsWeb.mime.no_match')}</p>}
      </Pane>

      <Pane title={t('toolsWeb.mime.check_file')} icon={Upload} bodyClassName="space-y-3 p-3">
        <input ref={fileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectFile(file); event.target.value = ''; }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void inspectFile(file); }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-xs font-semibold text-slate-500 transition-colors hover:border-cyan-500 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-400"
        >
          <Upload className="h-4 w-4" aria-hidden />{t('toolsWeb.mime.drop_file')}
        </button>
        {check && (
          <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('toolsWeb.mime.file_name'), value: `${check.name} (${formatBytes(check.size)})` },
              { label: t('toolsWeb.mime.browser_type'), value: check.browserType || '-' },
              { label: t('toolsWeb.mime.extension_type'), value: check.extensionType ?? '-' },
              { label: t('toolsWeb.mime.sniffed_type'), value: check.sniffed ?? '-' },
            ].map((row) => (
              <div key={row.label} className="min-w-0 rounded-lg border border-slate-200 p-2 dark:border-slate-700"><dt className="font-mono text-[10px] uppercase text-slate-500">{row.label}</dt><dd className="mt-0.5 break-all font-mono">{row.value}</dd></div>
            ))}
            <div className={`rounded-lg border px-3 py-2 font-semibold sm:col-span-2 lg:col-span-4 ${verdict === 'mismatch' ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
              {t(verdict === 'mismatch' ? 'toolsWeb.mime.verdict_mismatch' : 'toolsWeb.mime.verdict_ok')}
            </div>
          </dl>
        )}
      </Pane>
    </WebPage>
  );
};

export default MimeTypeLookupWorkbench;
