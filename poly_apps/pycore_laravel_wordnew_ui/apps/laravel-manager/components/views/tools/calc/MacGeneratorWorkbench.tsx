/** MAC address generator: separator, case, vendor prefix and unicast/local-bit options over a live list. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Shuffle } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Btn, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, MUTED_TEXT, NumField, Seg, Switch2, prefillInput, useAccent, useRecordUse } from './calcKit';
import { MAC_PRESETS, formatMac, generateMacs, macFlags, parseMacPrefix, type MacSeparator } from './netLogic';

const MAX_COUNT = 100;
const SEPARATORS: ReadonlyArray<{ value: MacSeparator; label: string }> = [
  { value: ':', label: 'aa:bb' }, { value: '-', label: 'aa-bb' }, { value: '.', label: 'aabb.' }, { value: '', label: 'aabb' },
];

const MacGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { count: 5, separator: ':', upper: true, prefix: '', local: true, multicast: false }), [lastRun]);
  const [count, setCount] = useState(initial.count);
  const [separator, setSeparator] = useState<MacSeparator>(SEPARATORS.some((s) => s.value === initial.separator) ? (initial.separator as MacSeparator) : ':');
  const [upper, setUpper] = useState(initial.upper);
  const [prefixText, setPrefixText] = useState(initial.prefix);
  const [local, setLocal] = useState(initial.local);
  const [multicast, setMulticast] = useState(initial.multicast);
  const [seed, setSeed] = useState(0);
  const copy = t('toolsCalc.common.copy');

  const prefix = useMemo(() => parseMacPrefix(prefixText), [prefixText]);
  const total = Math.min(MAX_COUNT, Math.max(1, Number.isFinite(count) ? Math.round(count) : 1));
  const macs = useMemo(
    () => (prefix ? generateMacs({ count: total, prefix, multicast, local }) : []),
    [prefix, total, multicast, local, seed], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const lines = useMemo(() => macs.map((bytes) => formatMac(bytes, separator, upper)), [macs, separator, upper]);

  const regenerate = (): void => setSeed((s) => s + 1);
  const recordAll = (): void => record({ count: total, separator, upper, prefix: prefixText, local, multicast }, { macs: lines.slice(0, 20) });

  useEffect(() => {
    if (seed > 0) recordAll();
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.macGen.options')} icon={<Shuffle className="h-3.5 w-3.5" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-3">
              <div><FieldLabel>{t('toolsCalc.macGen.count')}</FieldLabel><NumField value={count} onChange={setCount} min={1} max={MAX_COUNT} ariaLabel={t('toolsCalc.macGen.count')} /></div>
              <div>
                <FieldLabel htmlFor="mac-prefix">{t('toolsCalc.macGen.prefix')}</FieldLabel>
                <input id="mac-prefix" value={prefixText} onChange={(event) => setPrefixText(event.target.value)} placeholder="B8:27:EB" autoComplete="off" spellCheck={false} className={`${FIELD_CLASS} ${a.focus} ${prefix ? '' : 'border-red-500/60'}`} />
              </div>
            </div>
            <Chips value={null} onChange={setPrefixText} options={MAC_PRESETS.map((p) => ({ value: p.oui, label: p.key, title: p.oui }))} />
            {!prefix && <p className="text-xs text-red-500">{t('toolsCalc.macGen.prefix_invalid')}</p>}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Seg value={separator} onChange={setSeparator} ariaLabel={t('toolsCalc.macGen.separator')} options={SEPARATORS.map((s) => ({ value: s.value, label: s.label }))} />
              <Seg value={upper ? 'upper' : 'lower'} onChange={(v) => setUpper(v === 'upper')} ariaLabel={t('toolsCalc.macGen.case')} options={[{ value: 'upper', label: 'AA' }, { value: 'lower', label: 'aa' }]} />
            </div>
            <div className={`flex flex-wrap gap-x-5 gap-y-2 ${prefix && prefix.length > 0 ? 'opacity-40' : ''}`}>
              <Switch2 on={local} onChange={setLocal} label={t('toolsCalc.macGen.local')} />
              <Switch2 on={multicast} onChange={setMulticast} label={t('toolsCalc.macGen.multicast')} />
            </div>
            {prefix && prefix.length > 0 && <p className={`text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.macGen.flags_ignored')}</p>}
          </div>
        </div>
      </Card>

      <Card
        title={t('toolsCalc.macGen.results', { n: lines.length })}
        aside={(
          <div className="flex items-center gap-2">
            <CopyButton text={() => lines.join('\n')} label={copy} onCopied={recordAll}>{t('toolsCalc.macGen.copy_all')}</CopyButton>
            <Btn onClick={regenerate} icon={<RefreshCw className="h-3.5 w-3.5" />}>{t('toolsCalc.macGen.regenerate')}</Btn>
          </div>
        )}
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {macs.map((bytes, i) => {
            const flags = macFlags(bytes);
            return (
              <li key={`${seed}-${i}`} className="flex items-center gap-3 py-1.5">
                <span className="w-7 shrink-0 text-right font-mono text-[11px] text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{lines[i]}</span>
                <span className={`hidden shrink-0 gap-1 text-[10px] font-bold sm:flex ${MUTED_TEXT}`}>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{flags.multicast ? t('toolsCalc.macGen.multicast_short') : t('toolsCalc.macGen.unicast_short')}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{flags.local ? t('toolsCalc.macGen.local_short') : t('toolsCalc.macGen.global_short')}</span>
                </span>
                <CopyButton text={lines[i]} label={copy} />
              </li>
            );
          })}
        </ul>
      </Card>
    </Bench>
  );
};

export default MacGeneratorWorkbench;
