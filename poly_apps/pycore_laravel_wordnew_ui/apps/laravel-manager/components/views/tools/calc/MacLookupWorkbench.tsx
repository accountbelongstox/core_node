/** MAC vendor lookup: per-address byte anatomy (OUI/NIC, flag bits) with vendor names resolved by the server OUI database. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ScanSearch } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { callToolApi } from '../toolRunner';
import { Bench, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, MUTED_TEXT, Notice, prefillInput, useAccent, useRecordUse } from './calcKit';
import { formatMac, macFlags } from './netLogic';

interface MacLookupData { vendor: string | null; found: boolean }
interface Entry { status: 'found' | 'unknown' | 'error'; vendor: string | null }

interface ParsedLine { raw: string; bytes: number[]; oui: string; full: boolean }

const OUI_CACHE = new Map<string, Entry>();
const DEBOUNCE_MS = 600;
const MAX_LOOKUPS = 20;
const MIN_DIGITS = 6;
const MAX_DIGITS = 12;
const EXAMPLES = ['00:50:56:AB:CD:EF', 'B8:27:EB:12:34:56', '3C:22:FB:AA:BB:CC', 'DA:A1:19:00:11:22'] as const;
const LINE_PATTERN = /^[0-9a-f:.\-\s]+$/i;

const parseLine = (raw: string): ParsedLine | null => {
  const text = raw.trim();
  if (!text || !LINE_PATTERN.test(text)) return null;
  const digits = text.replace(/[^0-9a-f]/gi, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  const bytes = Array.from({ length: Math.floor(digits.length / 2) }, (_, i) => parseInt(digits.slice(i * 2, i * 2 + 2), 16));
  return { raw: text, bytes, oui: digits.slice(0, 6).toUpperCase(), full: digits.length === MAX_DIGITS };
};

const MacLookupWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { text: '00:50:56:AB:CD:EF' }), [lastRun]);
  const [text, setText] = useState(initial.text);
  const [version, setVersion] = useState(0);
  const recorded = useRef(initial.text);
  const copy = t('toolsCalc.common.copy');

  const lines = useMemo(() => text.split(/\r?\n/).filter((line) => line.trim() !== ''), [text]);
  const parsed = useMemo(() => lines.map((line) => ({ line, mac: parseLine(line) })), [lines]);
  const pendingKey = useMemo(() => {
    const seen = new Set<string>();
    parsed.forEach(({ mac }) => { if (mac && !macFlags(mac.bytes).local && !OUI_CACHE.has(mac.oui)) seen.add(mac.oui); });
    return Array.from(seen).slice(0, MAX_LOOKUPS).join(',');
  }, [parsed, version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingKey) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const oui of pendingKey.split(',')) {
        if (cancelled) return;
        try {
          const data = await callToolApi<MacLookupData>('itToolsV1.macLookup', { mac: oui });
          OUI_CACHE.set(oui, data.found && data.vendor ? { status: 'found', vendor: data.vendor } : { status: 'unknown', vendor: null });
        } catch {
          OUI_CACHE.set(oui, { status: 'error', vendor: null });
        }
        if (!cancelled) setVersion((v) => v + 1);
      }
      if (!cancelled && recorded.current !== text) {
        recorded.current = text;
        const vendors = Object.fromEntries(parsed.flatMap(({ mac }) => (mac && OUI_CACHE.get(mac.oui)?.vendor ? [[mac.oui, OUI_CACHE.get(mac.oui)?.vendor]] : [])));
        record({ text }, { vendors });
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = (oui: string): void => { OUI_CACHE.delete(oui); setVersion((v) => v + 1); };

  return (
    <Bench accent="net" server>
      <Card title={t('toolsCalc.macLookup.input')} icon={<ScanSearch className="h-3.5 w-3.5" />}>
        <FieldLabel htmlFor="mac-lookup-input">{t('toolsCalc.macLookup.label')}</FieldLabel>
        <textarea
          id="mac-lookup-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={Math.min(8, Math.max(2, lines.length + 1))}
          spellCheck={false}
          placeholder="00:1A:2B:3C:4D:5E"
          className={`${FIELD_CLASS} ${a.focus} resize-y text-base`}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Chips value={null} onChange={setText} options={EXAMPLES.map((example) => ({ value: example, label: example.slice(0, 8) }))} />
          <span className={`text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.macLookup.hint')}</span>
        </div>
      </Card>

      {parsed.length === 0 && <Notice tone="info">{t('toolsCalc.macLookup.empty')}</Notice>}

      <div className="space-y-3">
        {parsed.map(({ line, mac }, index) => {
          if (!mac) return <Notice key={`${index}:${line}`}>{t('toolsCalc.macLookup.invalid', { line })}</Notice>;
          const flags = macFlags(mac.bytes);
          const entry = OUI_CACHE.get(mac.oui);
          const formatted = formatMac(mac.bytes, ':', true);
          return (
            <Card key={`${index}:${line}`} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-lg font-bold text-slate-900 dark:text-slate-100">{formatted}</p>
                  <p className={`mt-0.5 font-mono text-[11px] ${MUTED_TEXT}`}>OUI {mac.oui.match(/.{2}/g)?.join('-')}</p>
                </div>
                <CopyButton text={formatted} label={copy} />
              </div>
              <div className="flex gap-1 font-mono text-sm font-bold">
                {Array.from({ length: 6 }, (_, i) => {
                  const known = i < mac.bytes.length;
                  const tone = i < 3 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  return <span key={i} className={`flex-1 rounded-md py-2 text-center ${known ? tone : 'border border-dashed border-slate-300 text-slate-400 dark:border-slate-700'}`}>{known ? mac.bytes[i].toString(16).padStart(2, '0').toUpperCase() : '··'}</span>;
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{flags.multicast ? t('toolsCalc.macLookup.multicast') : t('toolsCalc.macLookup.unicast')}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{flags.local ? t('toolsCalc.macLookup.local') : t('toolsCalc.macLookup.global')}</span>
              </div>
              <div className={`rounded-xl border px-3 py-2.5 ${entry?.status === 'found' ? `${a.border} ${a.tint}` : 'border-slate-200 dark:border-slate-800'}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{t('toolsCalc.macLookup.vendor')}</p>
                {flags.local ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t('toolsCalc.macLookup.randomized')}</p>
                ) : !entry ? (
                  <p className={`inline-flex items-center gap-2 text-sm ${MUTED_TEXT}`}><Loader2 className="h-4 w-4 animate-spin" />{t('toolsCalc.macLookup.looking')}</p>
                ) : entry.status === 'found' ? (
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{entry.vendor}</p>
                ) : entry.status === 'unknown' ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t('toolsCalc.macLookup.unknown')}</p>
                ) : (
                  <p className="text-sm text-red-500">{t('toolsCalc.macLookup.failed')} <button type="button" onClick={() => retry(mac.oui)} className="cursor-pointer font-bold underline">{t('toolsCalc.macLookup.retry')}</button></p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Bench>
  );
};

export default MacLookupWorkbench;
