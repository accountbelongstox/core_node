import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { notify } from '../../../../../../shared/notify/notify';
import { cmAdminUserPath } from '../../../../components/public-home/cmPublicRoutes';
import type { CmPagedList } from '../../../../components/workspace/useCmPagedList';
import { useCmAdminActionBuilders, useCmAdminActionState, type CmAdminActionState } from '../../../../admin/useCmAdminActions';
import { useCmAdminFormat } from '../../../../admin/useCmAdminData';
import type { CmAdminUserSummary } from '../../../../admin/CmAdminTypes';
import { MobileButton, MobileCard, MobileField, MobileListState, MobileNotice, MobilePager, MobileSheet } from '../../../ui';
import { MobileKeyValues, type MobileKeyValue } from '../parts/MobileKeyValues';
import { MobilePills } from '../parts/MobilePills';

const ALL_FILTER = '';

/** Confirmation sheet of the pending admin mutation: its text, a reason field when the rule asks for one, then confirm. */
export const AdminActionSheet: React.FC<{ state: CmAdminActionState }> = ({ state }) => {
  const { t } = useTranslation('cm');
  const { request, notice } = state;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonMode = request?.reason ?? 'none';

  useEffect(() => {
    setReason('');
    setError(null);
  }, [request]);

  useEffect(() => {
    if (!notice) return;
    notify.success(notice.text);
    state.setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  const close = (): void => {
    if (!busy) state.close();
  };

  const confirm = async (): Promise<void> => {
    if (reasonMode === 'required' && !reason.trim()) {
      setError(t('admin.dialog.reasonRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await state.submit(reason.trim());
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <MobileSheet
      open={request !== null}
      onClose={close}
      title={request?.title ?? ''}
      footer={request && (
        <>
          <MobileButton disabled={busy} onClick={close}>{t('common.cancel')}</MobileButton>
          <MobileButton variant={request.tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={() => void confirm()}>{busy ? t('admin.dialog.working') : request.confirmLabel}</MobileButton>
        </>
      )}
    >
      {request && (
        <div className="cmmc-form">
          {request.body && <p>{request.body}</p>}
          {reasonMode !== 'none' && (
            <MobileField label={`${request.reasonLabel ?? t('admin.dialog.reason')} ${reasonMode === 'required' ? t('admin.dialog.requiredMark') : t('admin.dialog.optionalMark')}`}>
              <textarea className="cmm-input cmmc-textarea" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            </MobileField>
          )}
          {error && <MobileNotice tone="error">{error}</MobileNotice>}
        </div>
      )}
    </MobileSheet>
  );
};

/** Admin mutations of the console: the shared confirmation requests plus the sheet that runs them; `sheet` goes in the screen. */
export function useMobileAdminActions(onDone: () => void | Promise<void>) {
  const state = useCmAdminActionState(onDone);
  const builders = useCmAdminActionBuilders(state.ask);
  return { ...builders, sheet: <AdminActionSheet state={state} /> };
}

interface AdminStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  optionLabel: (option: string) => string;
  ariaLabel: string;
  allLabel?: string;
}

/** Status filter as scrolling pills, with the "all" choice first. */
export const AdminStatusFilter: React.FC<AdminStatusFilterProps> = ({ value, onChange, options, optionLabel, ariaLabel, allLabel }) => {
  const { t } = useTranslation('cm');
  return (
    <MobilePills
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      options={[{ value: ALL_FILTER, label: allLabel ?? t('admin.allStatuses') }, ...options.map((option) => ({ value: option, label: optionLabel(option) }))]}
    />
  );
};

/** Text filter applied on submit or blur so typing does not fire a request per keystroke. */
export const AdminSearch: React.FC<{ value: string; onApply: (value: string) => void; placeholder: string; inputMode?: 'text' | 'numeric' }> = ({ value, onApply, placeholder, inputMode = 'text' }) => {
  const { t } = useTranslation('cm');
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <form className="cmm-search" role="search" onSubmit={(event) => { event.preventDefault(); onApply(draft.trim()); }}>
      <Search aria-hidden="true" />
      <input
        className="cmm-search__input"
        type="search"
        inputMode={inputMode}
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft.trim() !== value && onApply(draft.trim())}
      />
      {draft !== '' && (
        <button type="button" className="cmm-icon-btn" aria-label={t('common.dismiss')} onClick={() => { setDraft(''); onApply(''); }}><X aria-hidden="true" /></button>
      )}
    </form>
  );
};

/** Name of an account that opens its console detail. */
export const AdminUserLink: React.FC<{ user?: CmAdminUserSummary | null; userId?: number | null; fallbackKey?: string }> = ({ user, userId, fallbackKey = 'common.unavailable' }) => {
  const { t } = useTranslation('cm');
  const id = user?.id ?? userId ?? null;
  if (!id) return <>{t(fallbackKey)}</>;
  return <Link className="cmmc-link" to={cmAdminUserPath(id)}>{user?.username || user?.name || t('admin.userNumber', { id })}</Link>;
};

interface AdminRecordProps {
  title: React.ReactNode;
  badge?: React.ReactNode;
  facts: ReadonlyArray<MobileKeyValue | null | false>;
  note?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

/** One record of a console queue: title with status, facts, optional note and the actions its state allows. */
export const AdminRecord: React.FC<AdminRecordProps> = ({ title, badge, facts, note, children, actions }) => (
  <MobileCard className="cmmc-record">
    <header className="cmmc-record__head">
      <h3>{title}</h3>
      {badge}
    </header>
    <MobileKeyValues items={facts} />
    {note && <p className="cmmc-record__note">{note}</p>}
    {children}
    {actions && <div className="cmmc-row-actions">{actions}</div>}
  </MobileCard>
);

interface AdminRecordListProps<T> {
  list: CmPagedList<T>;
  emptyKey: string;
  renderRecord: (item: T) => React.ReactNode;
}

/** A console list as stacked record cards with the shared loading, error, empty and pager states. */
export function AdminRecordList<T>({ list, emptyKey, renderRecord }: AdminRecordListProps<T>): React.ReactElement {
  const { t } = useTranslation('cm');
  return (
    <>
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={t(emptyKey)}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <div className="cmmc-records">{list.items.map((item) => renderRecord(item))}</div>
      </MobileListState>
      <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </>
  );
}

/** Money and date formatting bound to the console currency. */
export function useAdminText() {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  return {
    t,
    money: (amount: string | number | null | undefined, currency?: string | null): string => (amount === null || amount === undefined || amount === '' ? t('common.unavailable') : format.money(amount, currency)),
    dateTime: (value: string | null | undefined): string => (value ? format.date(value, true) : t('common.unavailable')),
    date: (value: string | null | undefined): string => (value ? format.date(value, false, true) : t('common.unavailable')),
  };
}
