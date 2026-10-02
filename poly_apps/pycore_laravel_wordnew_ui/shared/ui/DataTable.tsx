import React from 'react';

const HEAD_CLS = 'gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500';
const ROW_CLS = 'gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition';

/** Outer frame of a table / list block. */
export const DataTableShell: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden ${className}`}>{children}</div>
);

/** Column-header row; `grid` is the Tailwind grid-cols class shared with the rows. */
export const DataTableHead: React.FC<{ grid: string; className?: string; children: React.ReactNode }> = ({ grid, className = 'grid', children }) => (
  <div className={`${className} ${grid} ${HEAD_CLS}`}>{children}</div>
);

/** Divided table body with its header row. */
export const DataTable: React.FC<{ grid: string; head: React.ReactNode; headClassName?: string; className?: string; children: React.ReactNode }> = ({
  grid, head, headClassName, className = '', children,
}) => (
  <div className={`divide-y divide-white/5 ${className}`}>
    <DataTableHead grid={grid} className={headClassName}>{head}</DataTableHead>
    {children}
  </div>
);

/** One grid row; `detail` (even null) switches to an expandable row with content below the grid. */
export const DataTableRow: React.FC<{ grid: string; className?: string; detail?: React.ReactNode; children: React.ReactNode }> = ({ grid, className = '', detail, children }) => (
  detail === undefined
    ? <div className={`grid ${grid} items-center ${ROW_CLS} ${className}`}>{children}</div>
    : (
      <div className={`${ROW_CLS} ${className}`}>
        <div className={`grid ${grid} gap-3 items-center`}>{children}</div>
        {detail}
      </div>
    )
);
