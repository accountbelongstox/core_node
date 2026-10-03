/** Random port generator: IANA range presets, well-known/service port avoidance and a position strip over 0-65535. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dices, RefreshCw } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Btn, Card, CopyButton, FieldLabel, MUTED_TEXT, Notice, NumField, Seg, Switch2, prefillInput, useRecordUse } from './calcKit';
import { PORT_MAX, PORT_MIN, REGISTERED_LIMIT, SERVICE_PORTS, WELL_KNOWN_LIMIT, generatePorts, portClass, type PortClass } from './netLogic';

type RangePreset = 'registered' | 'dynamic' | 'any' | 'custom';

const MAX_COUNT = 50;
const PRESET_RANGE: Record<Exclude<RangePreset, 'custom'>, [number, number]> = {
  registered: [WELL_KNOWN_LIMIT + 1, REGISTERED_LIMIT],
  dynamic: [REGISTERED_LIMIT + 1, PORT_MAX],
  any: [PORT_MIN, PORT_MAX],
};
const CLASS_STYLE: Record<PortClass, { chip: string; mark: string }> = {
  well_known: { chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', mark: 'bg-amber-400' },
  registered: { chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', mark: 'bg-sky-400' },
  dynamic: { chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', mark: 'bg-emerald-400' },
};
const PRESETS: readonly RangePreset[] = ['registered', 'dynamic', 'any', 'custom'];
const SCALE = PORT_MAX + 1;

const RandomPortWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { preset: 'registered', min: 1024, max: 65535, count: 5, avoidWellKnown: true, skipServices: true, unique: true, sorted: false }), [lastRun]);
  const [preset, setPreset] = useState<RangePreset>(PRESETS.includes(initial.preset as RangePreset) ? (initial.preset as RangePreset) : 'registered');
  const [customMin, setCustomMin] = useState(initial.min);
  const [customMax, setCustomMax] = useState(initial.max);
  const [count, setCount] = useState(initial.count);
  const [avoidWellKnown, setAvoidWellKnown] = useState(initial.avoidWellKnown);
  const [skipServices, setSkipServices] = useState(initial.skipServices);
  const [unique, setUnique] = useState(initial.unique);
  const [sorted, setSorted] = useState(initial.sorted);
  const [seed, setSeed] = useState(0);
  const copy = t('toolsCalc.common.copy');

  const [rawMin, rawMax] = preset === 'custom' ? [customMin, customMax] : PRESET_RANGE[preset];
  const rangeValid = Number.isFinite(rawMin) && Number.isFinite(rawMax);
  const min = avoidWellKnown ? Math.max(rawMin, WELL_KNOWN_LIMIT + 1) : rawMin;
  const total = Math.min(MAX_COUNT, Math.max(1, Number.isFinite(count) ? Math.round(count) : 1));

  const editMin = (value: number): void => {
    if (preset !== 'custom') { setCustomMax(rawMax); setPreset('custom'); }
    setCustomMin(value);
  };
  const editMax = (value: number): void => {
    if (preset !== 'custom') { setCustomMin(rawMin); setPreset('custom'); }
    setCustomMax(value);
  };

  const ports = useMemo(
    () => (rangeValid ? generatePorts({ min, max: rawMax, count: total, unique, skipServices, sorted }) : null),
    [rangeValid, min, rawMax, total, unique, skipServices, sorted, seed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (seed > 0 && ports) record({ preset, min: customMin, max: customMax, count: total, avoidWellKnown, skipServices, unique, sorted }, { ports });
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.port.options')} icon={<Dices className="h-3.5 w-3.5" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <FieldLabel>{t('toolsCalc.port.range')}</FieldLabel>
              <Seg value={preset} onChange={setPreset} ariaLabel={t('toolsCalc.port.range')} options={PRESETS.map((p) => ({ value: p, label: t(`toolsCalc.port.preset_${p}`) }))} />
            </div>
            <div className="grid grid-cols-3 items-end gap-3">
              <div><FieldLabel>{t('toolsCalc.port.min')}</FieldLabel><NumField value={rawMin} onChange={editMin} min={PORT_MIN} max={PORT_MAX} ariaLabel={t('toolsCalc.port.min')} /></div>
              <div><FieldLabel>{t('toolsCalc.port.max')}</FieldLabel><NumField value={rawMax} onChange={editMax} min={PORT_MIN} max={PORT_MAX} ariaLabel={t('toolsCalc.port.max')} /></div>
              <div><FieldLabel>{t('toolsCalc.port.count')}</FieldLabel><NumField value={count} onChange={setCount} min={1} max={MAX_COUNT} ariaLabel={t('toolsCalc.port.count')} /></div>
            </div>
          </div>
          <div className="space-y-2.5">
            <Switch2 on={avoidWellKnown} onChange={setAvoidWellKnown} label={t('toolsCalc.port.avoid_well_known')} />
            <Switch2 on={skipServices} onChange={setSkipServices} label={t('toolsCalc.port.skip_services')} />
            <Switch2 on={unique} onChange={setUnique} label={t('toolsCalc.port.unique')} />
            <Switch2 on={sorted} onChange={setSorted} label={t('toolsCalc.port.sorted')} />
          </div>
        </div>
      </Card>

      {!rangeValid && <Notice>{t('toolsCalc.port.range_invalid')}</Notice>}
      {rangeValid && !ports && <Notice>{t('toolsCalc.port.not_enough')}</Notice>}

      {ports && (
        <Card
          title={t('toolsCalc.port.generated', { n: ports.length })}
          aside={(
            <div className="flex items-center gap-2">
              <CopyButton text={() => ports.join(', ')} label={copy}>{t('toolsCalc.port.copy_all')}</CopyButton>
              <Btn onClick={() => setSeed((s) => s + 1)} icon={<RefreshCw className="h-3.5 w-3.5" />}>{t('toolsCalc.port.regenerate')}</Btn>
            </div>
          )}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {ports.map((port, i) => {
              const cls = portClass(port);
              const service = SERVICE_PORTS[port];
              return (
                <div key={`${seed}-${i}`} className="flex min-w-0 items-center justify-between gap-1 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="font-mono text-xl font-black text-slate-900 dark:text-white">{port}</p>
                    <span className={`mt-0.5 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${CLASS_STYLE[cls].chip}`}>{service ?? t(`toolsCalc.port.class_${cls}`)}</span>
                  </div>
                  <CopyButton text={String(port)} label={copy} />
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="relative h-3 overflow-hidden rounded-full">
              <div className="absolute inset-y-0 left-0 bg-amber-500/30" style={{ width: `${((WELL_KNOWN_LIMIT + 1) / SCALE) * 100}%` }} />
              <div className="absolute inset-y-0 bg-sky-500/30" style={{ left: `${((WELL_KNOWN_LIMIT + 1) / SCALE) * 100}%`, width: `${((REGISTERED_LIMIT - WELL_KNOWN_LIMIT) / SCALE) * 100}%` }} />
              <div className="absolute inset-y-0 right-0 bg-emerald-500/30" style={{ width: `${((SCALE - REGISTERED_LIMIT - 1) / SCALE) * 100}%` }} />
              {ports.map((port, i) => <i key={`${seed}-${i}`} className={`absolute inset-y-0 w-0.5 ${CLASS_STYLE[portClass(port)].mark}`} style={{ left: `${(port / SCALE) * 100}%` }} />)}
            </div>
            <div className={`mt-1 flex justify-between font-mono text-[10px] ${MUTED_TEXT}`}>
              <span>0</span><span>{WELL_KNOWN_LIMIT}</span><span>{REGISTERED_LIMIT}</span><span>{PORT_MAX}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
              {(['well_known', 'registered', 'dynamic'] as const).map((cls) => <span key={cls} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${CLASS_STYLE[cls].mark}`} />{t(`toolsCalc.port.class_${cls}`)}</span>)}
            </div>
          </div>
        </Card>
      )}
    </Bench>
  );
};

export default RandomPortWorkbench;
