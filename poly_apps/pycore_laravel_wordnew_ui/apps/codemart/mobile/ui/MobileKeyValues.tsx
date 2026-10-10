import React from 'react';

export interface MobileKeyValue {
  label: string;
  value: React.ReactNode;
}

/** Label and value pairs, one per line (record details in sheets and cards). Items with an empty value are skipped. */
export const MobileKeyValues: React.FC<{ items: ReadonlyArray<MobileKeyValue | null | false> }> = ({ items }) => (
  <dl className="cmm-kv">
    {items.map((item) => (item && item.value !== null && item.value !== undefined && item.value !== '' ? (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ) : null))}
  </dl>
);
