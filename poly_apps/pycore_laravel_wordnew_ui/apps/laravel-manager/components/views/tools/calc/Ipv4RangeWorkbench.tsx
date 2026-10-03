/** IPv4 range expander: ranges, CIDR and wildcards expanded into a virtualized address list with a count cap. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { List, type RowComponentProps } from 'react-window';
import { Download, ListOrdered } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { copyToClipboard, downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import { Bench, Btn, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, MUTED_TEXT, Notice, Seg, Stat, Switch2, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { KvRow } from './netKit';
import { formatIpv4, parseIpRange, rangeToCidrs } from './netLogic';

type Separator = 'newline' | 'comma' | 'space';

interface RowProps { start: number; onPick: (ip: string) => void }

const EXPAND_CAP = 1048576;
const ROW_HEIGHT = 30;
const LIST_HEIGHT = 340;
const CIDR_LIMIT = 64;
const EXAMPLES = ['192.168.1.1-192.168.1.50', '10.0.0.0/24', '172.16.5.*', '10.1.1.1-20'] as const;
const JOINERS: Record<Separator, string> = { newline: '\n', comma: ',', space: ' ' };

const IpRow = ({ index, style, start, onPick }: RowComponentProps<RowProps>): React.ReactElement => {
  const ip = formatIpv4(start + index);
  return (
    <button
      type="button"
      style={style}
      onClick={() => onPick(ip)}
      className="flex w-full cursor-pointer items-center gap-3 px-3 text-left font-mono text-sm text-slate-800 hover:bg-rose-500/10 dark:text-slate-200"
    >
      <span className="w-20 shrink-0 text-right text-[11px] text-slate-400">{index + 1}</span>
      <span>{ip}</span>
    </button>
  );
};

const Ipv4RangeWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { range: '192.168.1.1-192.168.1.50', skipEnds: false, separator: 'newline' }), [lastRun]);
  const [text, setText] = useState(initial.range);
  const [skipEnds, setSkipEnds] = useState(initial.skipEnds);
  const [separator, setSeparator] = useState<Separator>(initial.separator === 'comma' || initial.separator === 'space' ? initial.separator : 'newline');
  const [picked, setPicked] = useState('');
  const nf = new Intl.NumberFormat(i18n.language);

  const parsed = useMemo(() => parseIpRange(text), [text]);
  const range = typeof parsed === 'string' ? null : parsed;
  const span = useMemo(() => {
    if (!range) return null;
    const trim = skipEnds && range.end - range.start >= 2 ? 1 : 0;
    const start = range.start + trim;
    const end = range.end - trim;
    const total = end - start + 1;
    return { start, end, total, shown: Math.min(total, EXPAND_CAP) };
  }, [range, skipEnds]);
  const cidrs = useMemo(() => (span ? rangeToCidrs(span.start, span.end) : []), [span]);
  const rowProps = useMemo<RowProps>(() => ({ start: span?.start ?? 0, onPick: setPicked }), [span?.start]);

  const buildText = (): string => {
    if (!span) return '';
    const items: string[] = [];
    for (let i = 0; i < span.shown; i += 1) items.push(formatIpv4(span.start + i));
    return items.join(JOINERS[separator]);
  };

  useAutoRecord(record, { range: text, skipEnds, separator }, { count: span?.total ?? 0 }, span !== null);

  const copy = t('toolsCalc.common.copy');
  const errorKey = typeof parsed === 'string' && parsed !== 'empty' ? parsed : null;

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.range.input')} icon={<ListOrdered className="h-3.5 w-3.5" />}>
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="range-input">{t('toolsCalc.range.label')}</FieldLabel>
            <input
              id="range-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="192.168.1.1-192.168.1.50"
              autoComplete="off"
              spellCheck={false}
              className={`${FIELD_CLASS} ${a.focus} py-3 text-lg font-bold ${errorKey ? 'border-red-500/60' : ''}`}
            />
          </div>
          <Chips value={null} onChange={setText} options={EXAMPLES.map((e) => ({ value: e, label: e }))} />
          <Switch2 on={skipEnds} onChange={setSkipEnds} label={t('toolsCalc.range.skip_ends')} />
        </div>
      </Card>

      {errorKey && <Notice>{t(`toolsCalc.range.errors.${errorKey}`)}</Notice>}

      {span && range && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t('toolsCalc.range.count')} value={nf.format(span.total)} />
            <Stat label={t('toolsCalc.range.first')} value={formatIpv4(span.start)} />
            <Stat label={t('toolsCalc.range.last')} value={formatIpv4(span.end)} />
            <Stat label={t('toolsCalc.range.blocks')} value={cidrs.length} />
          </div>

          {span.total > EXPAND_CAP && <Notice>{t('toolsCalc.range.capped', { cap: nf.format(EXPAND_CAP), total: nf.format(span.total) })}</Notice>}

          <Card
            title={t('toolsCalc.range.addresses')}
            aside={(
              <div className="flex flex-wrap items-center gap-2">
                <Seg value={separator} onChange={setSeparator} ariaLabel={t('toolsCalc.range.separator')} options={(['newline', 'comma', 'space'] as const).map((s) => ({ value: s, label: t(`toolsCalc.range.sep_${s}`) }))} />
                <CopyButton text={buildText} label={copy}>{t('toolsCalc.range.copy_all')}</CopyButton>
                <Btn variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadAsFile(buildText(), 'ipv4-range.txt', 'text/plain')}>{t('toolsCalc.range.download')}</Btn>
              </div>
            )}
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
              <List<RowProps>
                style={{ height: Math.min(LIST_HEIGHT, span.shown * ROW_HEIGHT) }}
                defaultHeight={LIST_HEIGHT}
                rowComponent={IpRow}
                rowCount={span.shown}
                rowHeight={ROW_HEIGHT}
                rowProps={rowProps}
                overscanCount={8}
              />
            </div>
            <div className={`mt-2 flex items-center gap-2 text-xs ${MUTED_TEXT}`}>
              <span>{t('toolsCalc.range.tap_hint')}</span>
              {picked && <button type="button" onClick={() => { void copyToClipboard(picked); }} className={`cursor-pointer rounded-full ${a.tint} px-2 py-0.5 font-mono ${a.text}`}>{picked}</button>}
            </div>
          </Card>

          <Card title={t('toolsCalc.range.cidr_blocks')}>
            {cidrs.slice(0, CIDR_LIMIT).map((block) => (
              <KvRow key={block.network} label={`/${block.prefix}`} value={`${formatIpv4(block.network)}/${block.prefix}`} hint={nf.format(2 ** (32 - block.prefix))} copyLabel={copy} tone="accent" />
            ))}
            {cidrs.length > CIDR_LIMIT && <p className={`pt-2 text-[11px] ${MUTED_TEXT}`}>{t('toolsCalc.range.more_blocks', { n: cidrs.length - CIDR_LIMIT })}</p>}
          </Card>
        </>
      )}
    </Bench>
  );
};

export default Ipv4RangeWorkbench;
