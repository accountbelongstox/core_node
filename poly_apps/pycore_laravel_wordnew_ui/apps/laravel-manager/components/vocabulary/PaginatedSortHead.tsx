import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { PaginatedTableSort } from './PaginatedTableModel';

interface PaginatedSortHeadProps {
  label: React.ReactNode;
  sortKey: string;
  sort: PaginatedTableSort | null;
  onSort: (key: string) => void;
  className?: string;
}

const PaginatedSortHead: React.FC<PaginatedSortHeadProps> = ({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
}) => {
  const activeSort = sort?.key === sortKey ? sort.order : null;

  return (
    <th
      aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'}
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none hover:text-indigo-500 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {activeSort === 'asc'
          ? <ChevronUp className="w-3.5 h-3.5" />
          : activeSort === 'desc'
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />}
      </span>
    </th>
  );
};

export default PaginatedSortHead;
