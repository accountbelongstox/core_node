import React from 'react';

export interface MobileKeyValue {
  label: string;
  value: React.ReactNode;
}

/** Label and value pairs, one per line (record details inside sheets and cards). */
export const MobileKeyValues: React.FC<{ items: ReadonlyArray<MobileKeyValue | null | false> }> = ({ items }) => (
  <dl className="cmmc-kv">
    {items.map((item) => (item ? (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ) : null))}
  </dl>
);
