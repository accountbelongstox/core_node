/** IPv6 ULA generator (RFC 4193): random global IDs, an anatomy diagram of the address and ready-to-copy prefixes. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Shuffle } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Btn, Card, FIELD_CLASS, FieldLabel, MUTED_TEXT, NumField, prefillInput, useAccent, useRecordUse } from './calcKit';
import { KvRow } from './netKit';
import { composeUlaHost, generateUlaPrefix, hexToBytes, randomGlobalId, randomInterfaceId } from './netLogic';

interface UlaItem { globalId: string; interfaceId: number[] }

const MAX_COUNT = 20;
const SUBNET_PATTERN = /^[0-9a-f]{1,4}$/i;
const newItem = (): UlaItem => ({ globalId: randomGlobalId(), interfaceId: randomInterfaceId() });
const hex4 = (n: number): string => n.toString(16).padStart(4, '0');

const Ipv6UlaWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { count: 1, subnet: '0001' }), [lastRun]);
  const [count, setCount] = useState(initial.count);
  const [subnetText, setSubnetText] = useState(initial.subnet);
  const [items, setItems] = useState<UlaItem[]>(() => [newItem()]);
  const [selected, setSelected] = useState(0);
  const copy = t('toolsCalc.common.copy');

  const subnetValid = SUBNET_PATTERN.test(subnetText);
  const subnetId = subnetValid ? parseInt(subnetText, 16) : 0;
  const rows = useMemo(() => items.map((item) => {
    const prefix = generateUlaPrefix(subnetId, hexToBytes(item.globalId));
    return { item, prefix, host: composeUlaHost(prefix.groups, item.interfaceId) };
  }), [items, subnetId]);
  const current = rows[Math.min(selected, rows.length - 1)];

  const generate = (): void => {
    const total = Math.min(MAX_COUNT, Math.max(1, Number.isFinite(count) ? Math.round(count) : 1));
    const next = Array.from({ length: total }, newItem);
    setItems(next);
    setSelected(0);
    const prefixes = next.map((item) => generateUlaPrefix(subnetId, hexToBytes(item.globalId)).prefix48);
    record({ count: total, subnet: subnetText }, { prefixes });
  };

  const segments = current ? [
    { key: 'prefix', label: t('toolsCalc.ula.seg_prefix'), bits: 8, text: 'fd', style: 'bg-rose-700 text-white' },
    { key: 'global', label: t('toolsCalc.ula.seg_global'), bits: 40, text: `${current.item.globalId.slice(0, 2)}:${current.item.globalId.slice(2, 6)}:${current.item.globalId.slice(6)}`, style: 'bg-rose-500 text-white' },
    { key: 'subnet', label: t('toolsCalc.ula.seg_subnet'), bits: 16, text: hex4(subnetId), style: 'bg-rose-300 text-rose-950' },
    { key: 'iid', label: t('toolsCalc.ula.seg_interface'), bits: 64, text: current.item.interfaceId.map(hex4).join(':'), style: 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
  ] : [];

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.ula.generate')} icon={<Shuffle className="h-3.5 w-3.5" />}>
        <div className="grid items-end gap-3 sm:grid-cols-[8rem_10rem_auto]">
          <div>
            <FieldLabel>{t('toolsCalc.ula.count')}</FieldLabel>
            <NumField value={count} onChange={setCount} min={1} max={MAX_COUNT} ariaLabel={t('toolsCalc.ula.count')} />
          </div>
          <div>
            <FieldLabel htmlFor="ula-subnet">{t('toolsCalc.ula.subnet_id')}</FieldLabel>
            <input id="ula-subnet" value={subnetText} onChange={(event) => setSubnetText(event.target.value.trim())} maxLength={4} spellCheck={false} className={`${FIELD_CLASS} ${a.focus} ${subnetValid ? '' : 'border-red-500/60'}`} />
          </div>
          <Btn onClick={generate} disabled={!subnetValid} icon={<RefreshCw className="h-3.5 w-3.5" />}>{t('toolsCalc.ula.regenerate')}</Btn>
        </div>
        <p className={`mt-3 text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.ula.rfc_hint')}</p>
      </Card>

      {current && (
        <Card title={t('toolsCalc.ula.anatomy')}>
          <div className="flex overflow-hidden rounded-lg font-mono text-[11px] font-bold sm:text-sm">
            {segments.map((seg) => (
              <div key={seg.key} className={`flex min-w-0 flex-col items-center justify-center px-1 py-3 ${seg.style}`} style={{ flexGrow: Math.sqrt(seg.bits), flexBasis: 0 }} title={`${seg.label} (${seg.bits} bit)`}>
                <span className="max-w-full truncate">{seg.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex font-mono text-[10px]">
            {segments.map((seg) => (
              <div key={seg.key} className={`min-w-0 px-1 text-center ${MUTED_TEXT}`} style={{ flexGrow: Math.sqrt(seg.bits), flexBasis: 0 }}>
                <span className="block truncate">{seg.label}</span>
                <span className="block">{seg.bits} bit</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {current && (
        <Card title={t('toolsCalc.ula.details')}>
          <KvRow label={t('toolsCalc.ula.prefix48')} value={current.prefix.prefix48} tone="accent" copyLabel={copy} />
          <KvRow label={t('toolsCalc.ula.first64')} value={current.prefix.subnet64} copyLabel={copy} />
          <KvRow label={t('toolsCalc.ula.global_id')} value={current.item.globalId} copyLabel={copy} />
          <KvRow label={t('toolsCalc.ula.sample_host')} value={current.host} copyLabel={copy} />
          <KvRow label={t('toolsCalc.ula.reverse_zone')} value={current.prefix.reverseZone} tone="muted" copyLabel={copy} />
        </Card>
      )}

      {rows.length > 1 && (
        <Card title={t('toolsCalc.ula.generated', { n: rows.length })}>
          <ul className="space-y-1">
            {rows.map((row, i) => (
              <li key={row.item.globalId}>
                <button type="button" onClick={() => setSelected(i)} className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left font-mono text-sm transition ${i === selected ? `${a.tint} ${a.text}` : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                  <span>{row.prefix.prefix48}</span>
                  <span className={`text-[11px] ${MUTED_TEXT}`}>#{i + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Bench>
  );
};

export default Ipv6UlaWorkbench;
