import React from 'react';

export interface MobileKeyValueItem {
  label: string;
  value: React.ReactNode;
}

/** Label and value rows of one record (budget, dates, roles). Items with an empty value are skipped. */
export const MobileKeyValue: React.FC<{ items: ReadonlyArray<MobileKeyValueItem | null | false> }> = ({ items }) => (
  <dl className="cmm-kv">
    {items.map((item) => (item && item.value !== null && item.value !== undefined && item.value !== ''
      ? <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
      : null))}
  </dl>
);
