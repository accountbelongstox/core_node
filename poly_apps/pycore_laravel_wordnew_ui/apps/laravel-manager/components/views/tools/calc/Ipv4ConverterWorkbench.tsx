/** IPv4 converter: dotted, decimal, hex, binary and octal fields that stay linked while you type in any of them. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Card, CopyButton, FIELD_CLASS, MUTED_TEXT, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { BitCells, KvRow } from './netKit';
import { IPV4_FIELDS, bitsOf, classifyIpv4, formatIpv4Field, ipv4MappedIpv6, ipv4Octets, ipv4ReverseDns, parseIpv4Field, type Ipv4Field } from './netLogic';

type Fields = Record<Ipv4Field, string>;

const PLACEHOLDERS: Record<Ipv4Field, string> = {
  dotted: '192.168.1.1', decimal: '3232235777', hex: '0xC0A80101', binary: '11000000.10101000.00000001.00000001', octal: '030052000401',
};

const fieldsFrom = (n: number): Fields => Object.fromEntries(IPV4_FIELDS.map((f) => [f, formatIpv4Field(f, n)])) as Fields;

const Ipv4ConverterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { dotted: '192.168.1.1' }), [lastRun]);
  const startValue = useMemo(() => parseIpv4Field('dotted', initial.dotted) ?? parseIpv4Field('dotted', '192.168.1.1') as number, [initial.dotted]);
  const [value, setValue] = useState<number | null>(startValue);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(startValue));
  const [invalid, setInvalid] = useState<Ipv4Field | null>(null);

  const edit = (field: Ipv4Field, text: string): void => {
    const parsed = parseIpv4Field(field, text);
    if (parsed === null) {
      setFields((prev) => ({ ...prev, [field]: text }));
      setInvalid(text.trim() === '' ? null : field);
      setValue(null);
      return;
    }
    setInvalid(null);
    setValue(parsed);
    setFields({ ...fieldsFrom(parsed), [field]: text });
  };

  const copy = t('toolsCalc.common.copy');
  const dotted = value === null ? '' : formatIpv4Field('dotted', value);
  useAutoRecord(record, { dotted }, { decimal: value === null ? '' : formatIpv4Field('decimal', value) }, value !== null);

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.ipv4Converter.formats')} icon={<ArrowLeftRight className="h-3.5 w-3.5" />}>
        <div className="space-y-3">
          {IPV4_FIELDS.map((field) => (
            <div key={field}>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor={`ipv4-${field}`} className={`text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}>{t(`toolsCalc.ipv4Converter.${field}`)}</label>
                <span className={`text-[10px] ${invalid === field ? 'text-red-500' : MUTED_TEXT}`}>{invalid === field ? t('toolsCalc.ipv4Converter.invalid') : t(`toolsCalc.ipv4Converter.${field}_hint`)}</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id={`ipv4-${field}`}
                  value={fields[field]}
                  onChange={(event) => edit(field, event.target.value)}
                  placeholder={PLACEHOLDERS[field]}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD_CLASS} ${a.focus} ${invalid === field ? 'border-red-500/70' : ''} ${invalid && invalid !== field ? 'opacity-60' : ''}`}
                />
                <CopyButton text={fields[field]} label={copy} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {value !== null && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={t('toolsCalc.ipv4Converter.bits')}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
              {ipv4Octets(value).map((octet, o) => (
                <div key={o} className="space-y-1">
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{octet}</p>
                  <BitCells bits={bitsOf(value).slice(o * 8, o * 8 + 8)} offset={o * 8} networkBits={32} dim />
                </div>
              ))}
            </div>
          </Card>
          <Card title={t('toolsCalc.ipv4Converter.derived')}>
            <KvRow label={t('toolsCalc.ipv4Converter.mapped')} value={ipv4MappedIpv6(value)} copyLabel={copy} />
            <KvRow label={t('toolsCalc.ipv4Converter.reverse')} value={ipv4ReverseDns(value)} copyLabel={copy} />
            <KvRow label={t('toolsCalc.subnet.type')} value={t(`toolsCalc.net.kind.${classifyIpv4(value)}`)} tone="muted" copyLabel={copy} />
          </Card>
        </div>
      )}
    </Bench>
  );
};

export default Ipv4ConverterWorkbench;
