/** IPv4 subnet calculator: 32-bit network/host bit map, CIDR slider, result fields and subnet split. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Split } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, MUTED_TEXT, Notice, Slider, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { BitCells, KvRow } from './netKit';
import { bitsOf, formatIpv4, ipv4Octets, parseSubnetInput, prefixToMask, splitSubnets, subnetInfo } from './netLogic';

const PREFIX_PRESETS = [8, 16, 24, 28, 30, 32] as const;
const MAX_SPLIT_DEPTH = 16;
const SPLIT_ROW_LIMIT = 256;
const BITS_PER_OCTET = 8;

const IpSubnetWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { ip: '192.168.1.10', prefix: 24, splitDepth: 2 }), [lastRun]);
  const [ipText, setIpText] = useState(initial.ip);
  const [prefix, setPrefix] = useState(initial.prefix);
  const [splitDepth, setSplitDepth] = useState(initial.splitDepth);
  const nf = new Intl.NumberFormat(i18n.language);

  const parsed = useMemo(() => parseSubnetInput(ipText), [ipText]);
  const info = useMemo(() => (parsed ? subnetInfo(parsed.ip, prefix) : null), [parsed, prefix]);

  const handleIp = (text: string): void => {
    setIpText(text);
    const next = parseSubnetInput(text);
    if (next && next.prefix !== null) setPrefix(next.prefix);
  };

  const toggleBit = (index: number): void => {
    if (!parsed) return;
    handleIp(formatIpv4((parsed.ip ^ (2 ** (31 - index))) >>> 0));
  };

  const depth = Math.min(Math.max(1, splitDepth), Math.min(MAX_SPLIT_DEPTH, 32 - prefix));
  const split = useMemo(() => (info && prefix < 32 ? splitSubnets(info.network, prefix, prefix + depth, SPLIT_ROW_LIMIT) : null), [info, prefix, depth]);
  const cidr = info ? `${formatIpv4(info.network)}/${prefix}` : '';

  useAutoRecord(record, { ip: ipText, prefix, splitDepth }, { network: cidr }, info !== null);

  const octets = info ? ipv4Octets(info.ip) : [];
  const maskBits = bitsOf(info ? info.mask : prefixToMask(prefix));
  const ipBits = info ? bitsOf(info.ip) : '';
  const netBits = info ? bitsOf(info.network) : '';
  const copy = t('toolsCalc.common.copy');

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.subnet.address')} icon={<Network className="h-3.5 w-3.5" />}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="subnet-ip">{t('toolsCalc.subnet.ip_or_cidr')}</FieldLabel>
            <input
              id="subnet-ip"
              value={ipText}
              onChange={(event) => handleIp(event.target.value)}
              placeholder="192.168.1.10/24"
              autoComplete="off"
              spellCheck={false}
              className={`${FIELD_CLASS} ${a.focus} py-3 text-xl font-bold ${parsed ? '' : 'border-red-500/60'}`}
            />
          </div>
          <Slider label={t('toolsCalc.subnet.prefix')} value={prefix} min={0} max={32} step={1} onChange={setPrefix} format={(v) => `/${v}`} />
          <Chips value={prefix} onChange={setPrefix} options={PREFIX_PRESETS.map((p) => ({ value: p, label: `/${p}` }))} />
        </div>
      </Card>

      {!parsed && ipText.trim() !== '' && <Notice>{t('toolsCalc.subnet.invalid')}</Notice>}

      {info && (
        <>
          <Card
            title={t('toolsCalc.subnet.bitmap')}
            aside={(
              <span className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-rose-500" />{t('toolsCalc.subnet.network_bits')} {prefix}</span>
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-400" />{t('toolsCalc.subnet.host_bits')} {32 - prefix}</span>
              </span>
            )}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4">
              {octets.map((octet, o) => {
                const from = o * BITS_PER_OCTET;
                const slice = (bits: string): string => bits.slice(from, from + BITS_PER_OCTET);
                return (
                  <div key={o} className="min-w-0 space-y-1">
                    <p className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">{octet}<span className={`ml-1 text-[10px] font-normal ${MUTED_TEXT}`}>{t('toolsCalc.subnet.octet', { n: o + 1 })}</span></p>
                    <BitCells bits={slice(ipBits)} offset={from} networkBits={prefix} onToggle={toggleBit} label={t('toolsCalc.subnet.ip_bits')} />
                    <BitCells bits={slice(maskBits)} offset={from} networkBits={prefix} dim />
                    <BitCells bits={slice(netBits)} offset={from} networkBits={prefix} dim />
                  </div>
                );
              })}
            </div>
            <p className={`mt-3 text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.subnet.bitmap_hint')}</p>
          </Card>

          <Card title={t('toolsCalc.subnet.result')} aside={<CopyButton text={cidr} label={copy}>{cidr}</CopyButton>}>
            <div className="grid gap-x-6 md:grid-cols-2">
              <div>
                <KvRow label={t('toolsCalc.subnet.network')} value={formatIpv4(info.network)} tone="accent" copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.broadcast')} value={formatIpv4(info.broadcast)} copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.netmask')} value={formatIpv4(info.mask)} hint={`/${prefix}`} copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.wildcard')} value={formatIpv4(info.wildcard)} copyLabel={copy} />
              </div>
              <div>
                <KvRow label={t('toolsCalc.subnet.first_host')} value={formatIpv4(info.first)} copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.last_host')} value={formatIpv4(info.last)} copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.total')} value={nf.format(info.total)} copyLabel={copy} />
                <KvRow label={t('toolsCalc.subnet.usable')} value={nf.format(info.usable)} copyLabel={copy} />
              </div>
            </div>
            <div className="mt-2 grid gap-x-6 md:grid-cols-2">
              <KvRow label={t('toolsCalc.subnet.class')} value={info.klass} tone="muted" copyLabel={copy} />
              <KvRow label={t('toolsCalc.subnet.type')} value={t(`toolsCalc.net.kind.${info.kind}`)} tone="muted" copyLabel={copy} />
            </div>
          </Card>

          {split && (
            <Card title={t('toolsCalc.subnet.split')} icon={<Split className="h-3.5 w-3.5" />} aside={<span className={`font-mono text-xs ${MUTED_TEXT}`}>{t('toolsCalc.subnet.split_count', { n: nf.format(split.count) })}</span>}>
              <Slider label={t('toolsCalc.subnet.split_prefix')} value={depth} min={1} max={Math.min(MAX_SPLIT_DEPTH, 32 - prefix)} step={1} onChange={setSplitDepth} format={(v) => `/${prefix + v}`} />
              <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[420px] border-collapse font-mono text-xs">
                  <thead className={`sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider dark:bg-slate-900 ${MUTED_TEXT}`}>
                    <tr>
                      <th className="px-3 py-2 text-left">{t('toolsCalc.subnet.subnet')}</th>
                      <th className="px-3 py-2 text-left">{t('toolsCalc.subnet.host_range')}</th>
                      <th className="px-3 py-2 text-right">{t('toolsCalc.subnet.usable')}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                    {split.rows.map((row) => (
                      <tr key={row.network} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="whitespace-nowrap px-3 py-1.5 font-bold text-rose-600 dark:text-rose-300">{formatIpv4(row.network)}/{prefix + depth}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{formatIpv4(row.first)} – {formatIpv4(row.last)}</td>
                        <td className="px-3 py-1.5 text-right">{nf.format(row.usable)}</td>
                        <td className="px-1"><CopyButton text={`${formatIpv4(row.network)}/${prefix + depth}`} label={copy} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {split.count > SPLIT_ROW_LIMIT && <p className={`mt-2 text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.subnet.split_limited', { shown: SPLIT_ROW_LIMIT, total: nf.format(split.count) })}</p>}
            </Card>
          )}
        </>
      )}
    </Bench>
  );
};

export default IpSubnetWorkbench;
