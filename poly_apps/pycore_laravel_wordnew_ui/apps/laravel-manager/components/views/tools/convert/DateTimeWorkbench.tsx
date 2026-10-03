/** Date/time converter: one instant, a card per format and per time zone, live "now" mode. */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Plus, X } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  buildDateFormats, buildZoneView, DATE_FORMAT_IDS, DEFAULT_ZONES, listZones, LOCAL_ZONE, parseDateInput, toLocalInputValue, type DateFormatId,
} from './convertDate';
import {
  ConvertPage, ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, MONO_CLASS, Notice, Panel, PRIMARY_BUTTON_CLASS, prefillOf, ToggleField, useConvertT, useCopy,
  useDebouncedRecord, useRecorder, useUiLocale,
} from './convertKit';

interface DateInput {
  input: string;
  zone: string;
}

const TICK_MS = 1000;
const PRIMARY_FORMATS: DateFormatId[] = ['unixSeconds', 'unixMillis', 'iso'];

const DateTimeWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const tc = useConvertT();
  const locale = useUiLocale();
  const prefill = prefillOf<DateInput>(lastRun);
  const [input, setInput] = useState(prefill.input ?? '');
  const [zone, setZone] = useState(prefill.zone || LOCAL_ZONE);
  const [zones, setZones] = useState<string[]>(DEFAULT_ZONES);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [pendingZone, setPendingZone] = useState('');
  const { copied, copy } = useCopy();
  const record = useRecorder(tool.id, variant);
  const allZones = useMemo(() => listZones(), []);

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [live]);

  const parsed = useMemo(() => (input.trim() ? parseDateInput(input, zone) : null), [input, zone]);
  const invalid = input.trim() !== '' && parsed === null;
  const date = input.trim() === '' ? now : parsed;
  const formats = useMemo(() => (date ? buildDateFormats(date, zone, now, locale) : null), [date, zone, now, locale]);
  const zoneViews = useMemo(() => (date ? zones.map((entry) => buildZoneView(date, entry, locale)) : []), [date, zones, locale]);

  useDebouncedRecord(tool.id, variant, { input, zone }, formats?.iso ?? '', Boolean(input.trim() && formats));

  const copyValue = async (id: string, value: string): Promise<void> => {
    if (await copy(value, id)) record({ input, zone }, value);
  };

  const addZone = (): void => {
    if (pendingZone && !zones.includes(pendingZone)) setZones((prev) => [...prev, pendingZone]);
    setPendingZone('');
  };

  const card = (id: string, label: string, value: string, large = false): React.ReactNode => (
    <button
      key={id}
      type="button"
      onClick={() => copyValue(id, value)}
      className="group flex min-w-0 flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-400 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:border-sky-500/60"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className={LABEL_CLASS}>{label}</span>
        {copied === id && <Check className="h-3.5 w-3.5 text-emerald-500" />}
      </span>
      <span className={`${MONO_CLASS} w-full break-all text-slate-900 dark:text-slate-100 ${large ? 'text-base font-semibold' : ''}`}>{value}</span>
    </button>
  );

  return (
    <ConvertPage wide>
      <Panel className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={tc('datetime.placeholder')}
            spellCheck={false}
            aria-label={tc('datetime.input')}
            className={`${INPUT_CLASS} ${MONO_CLASS} min-w-[14rem] flex-1 text-base ${invalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
          />
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setInput(''); setNow(new Date()); setLive(true); }}>
            <Clock className="h-3.5 w-3.5" />{tc('datetime.now')}
          </button>
          <input
            type="datetime-local"
            step={1}
            value={date ? toLocalInputValue(date, zone) : ''}
            onChange={(event) => event.target.value && setInput(event.target.value)}
            aria-label={tc('datetime.picker')}
            className={`${INPUT_CLASS} !w-auto`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className={LABEL_CLASS}>{tc('datetime.zone')}</span>
            <select value={zone} onChange={(event) => setZone(event.target.value)} className={`${INPUT_CLASS} !w-auto !py-1`}>
              {(allZones.includes(zone) ? allZones : [zone, ...allZones]).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <ToggleField label={tc('datetime.live')} on={live} onChange={setLive} />
        </div>
        {invalid && <Notice>{tc('errors.invalid_date')}</Notice>}
        {!invalid && input.trim() === '' && <p className="text-xs text-slate-500 dark:text-slate-400">{tc('datetime.hint')}</p>}
      </Panel>
      {formats && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRIMARY_FORMATS.map((id) => card(id, tc(`datetime.format_${id}`), formats[id], true))}
            {DATE_FORMAT_IDS.filter((id) => !PRIMARY_FORMATS.includes(id)).map((id) => card(id, tc(`datetime.format_${id}`), formats[id]))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className={LABEL_CLASS}>{tc('datetime.zones')}</span>
            <div className="flex items-center gap-1.5">
              <select value={pendingZone} onChange={(event) => setPendingZone(event.target.value)} aria-label={tc('datetime.add_zone')} className={`${INPUT_CLASS} !w-44 !py-1 text-xs`}>
                <option value="">{tc('datetime.add_zone')}</option>
                {allZones.filter((entry) => !zones.includes(entry)).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
              <button type="button" disabled={!pendingZone} onClick={addZone} className={PRIMARY_BUTTON_CLASS} aria-label={tc('datetime.add_zone')}><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {zoneViews.map((view) => (
              <div key={view.zone} className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40">
                <button type="button" onClick={() => copyValue(`zone:${view.zone}`, view.iso)} className="block w-full min-w-0 text-left" title={tc('common.copy')}>
                  <div className="flex items-center justify-between gap-2 pr-6">
                    <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{view.zone}</span>
                    {copied === `zone:${view.zone}` && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-sky-700 dark:text-sky-300">{view.time}</div>
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{view.date} &middot; {view.offset}{view.abbreviation ? ` \u00b7 ${view.abbreviation}` : ''}</div>
                </button>
                {zones.length > 1 && (
                  <button type="button" onClick={() => setZones((prev) => prev.filter((entry) => entry !== view.zone))} aria-label={tc('common.remove')} className={`${ICON_BUTTON_CLASS} absolute right-1.5 top-1.5 !p-1`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </ConvertPage>
  );
};

export default DateTimeWorkbench;
