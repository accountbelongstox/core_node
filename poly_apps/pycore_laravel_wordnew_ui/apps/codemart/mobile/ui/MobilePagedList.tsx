import React from 'react';
import type { CmPagedList } from '../../components/workspace/useCmPagedList';
import { MobileList } from './MobileListRow';
import { MobilePager } from './MobilePager';
import { MobileListState } from './MobileStates';

interface MobilePagedListProps<T> {
  list: CmPagedList<T>;
  emptyTitle: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  renderRow: (item: T) => React.ReactNode;
  label?: string;
}

/** A server-paged list as grouped rows: skeleton, error with retry, empty state, then rows and the pager. */
export function MobilePagedList<T>({ list, emptyTitle, emptyBody, emptyAction, renderRow, label }: MobilePagedListProps<T>): React.ReactElement {
  return (
    <>
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyAction={emptyAction}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <MobileList label={label}>{list.items.map((item) => renderRow(item))}</MobileList>
      </MobileListState>
      <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </>
  );
}
