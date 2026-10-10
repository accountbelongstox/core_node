import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CM_ADMIN_ROUTE, cmAdminUserPath, cmRouteWithQuery } from '../components/public-home/cmPublicRoutes';
import { CmNotice } from '../components/workspace/CmStateViews';
import { cmHumanize } from '../components/workspace/cmWorkspaceFormat';
import { useCmAdminFormat } from './useCmAdminData';
import { useCmAdminActionState, type CmAdminActionRequest } from './useCmAdminActions';
import type { CmAdminActivityRow, CmAdminUserSummary } from './CmAdminTypes';

/** Locale prefix holding each server state group's translations (vocabulary.activity.resource_state_groups). */
const CM_ACTIVITY_STATE_GROUP_PREFIX: Record<string, string> = {
  role: 'states.role',
  project: 'states.project',
  milestone: 'states.milestone',
  task: 'states.task',
  submission: 'states.submission',
  payment: 'states.payment',
  kyc: 'states.kyc',
  deposit: 'admin.states.deposit',
  refund: 'admin.states.refund',
  withdrawal: 'admin.states.withdrawal',
  escrow: 'admin.states.escrow',
  testimonial: 'admin.states.testimonial',
  reviewer_application: 'admin.states.reviewer',
  contact_message: 'admin.states.contact',
};

export type { CmAdminActionRequest, CmAdminReasonMode } from './useCmAdminActions';
export { useCmAdminFormat, useCmAdminList, useCmAdminParam } from './useCmAdminData';

/** Confirmation dialog workflow with optional or required reason for every admin mutation. */
export function useCmAdminAction(onDone: () => void | Promise<void>) {
  const state = useCmAdminActionState(onDone);
  const dialog = state.request ? <CmAdminDialog request={state.request} onCancel={state.close} onSubmit={state.submit} /> : null;

  return { ask: state.ask, dialog, notice: state.notice, setNotice: state.setNotice };
}

const CmAdminDialog: React.FC<{
  request: CmAdminActionRequest;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<string | null>;
}> = ({ request, onCancel, onSubmit }) => {
  const { t } = useTranslation('cm');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonMode = request.reason ?? 'none';

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const confirm = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (reasonMode === 'required' && !reason.trim()) {
      setError(t('admin.dialog.reasonRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onSubmit(reason.trim());
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <div className="cm-admin-dialog" role="presentation" onClick={() => !busy && onCancel()}>
      <form
        className="cm-admin-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-admin-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void confirm(event)}
      >
        <h2 id="cm-admin-dialog-title">{request.title}</h2>
        {request.body && <p>{request.body}</p>}
        {reasonMode !== 'none' && (
          <label>
            <span>
              {request.reasonLabel ?? t('admin.dialog.reason')}
              {reasonMode === 'required' ? ` ${t('admin.dialog.requiredMark')}` : ` ${t('admin.dialog.optionalMark')}`}
            </span>
            <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
          </label>
        )}
        <CmNotice notice={error ? { tone: 'error', text: error } : null} />
        <div className="cm-admin-dialog__actions">
          <button type="button" className="cm-workspace-button" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={`cm-workspace-button ${request.tone === 'danger' ? 'is-danger' : 'is-primary'}`} disabled={busy}>
            {busy ? t('admin.dialog.working') : request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export const CmAdminToolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="cm-marketplace-toolbar cm-admin-toolbar">{children}</section>
);

export const CmAdminSelect: React.FC<{
  labelKey: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  optionLabel: (option: string) => string;
  allKey?: string;
}> = ({ labelKey, value, onChange, options, optionLabel, allKey = 'admin.allStatuses' }) => {
  const { t } = useTranslation('cm');
  return (
    <label>
      <span>{t(labelKey)}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t(allKey)}</option>
        {options.map((option) => (
          <option key={option} value={option}>{optionLabel(option)}</option>
        ))}
      </select>
    </label>
  );
};

/** Text filter applied on Enter or blur so typing does not fire a request per keystroke. */
export const CmAdminSearch: React.FC<{
  labelKey: string;
  value: string;
  onApply: (value: string) => void;
  icon?: boolean;
  inputMode?: 'text' | 'numeric';
  placeholderKey?: string;
}> = ({ labelKey, value, onApply, icon = true, inputMode = 'text', placeholderKey }) => {
  const { t } = useTranslation('cm');
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label>
      <span>{t(labelKey)}</span>
      <div>
        {icon && <Search aria-hidden="true" />}
        <input
          type="search"
          value={draft}
          inputMode={inputMode}
          placeholder={placeholderKey ? t(placeholderKey) : undefined}
          className={icon ? '' : 'cm-admin-input--plain'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft.trim() !== value && onApply(draft.trim())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onApply(draft.trim());
          }}
        />
      </div>
    </label>
  );
};

/** Table that scrolls horizontally inside its own card instead of widening the page. */
export const CmAdminTable: React.FC<{ children: React.ReactNode; label?: string; actions?: boolean }> = ({ children, label, actions = false }) => (
  <div className="cm-admin-table" data-actions={actions || undefined} role="region" aria-label={label} tabIndex={0}>
    <table className="cm-table">{children}</table>
  </div>
);

export const CmAdminDate: React.FC<{ value: string | null | undefined; dateOnly?: boolean; stacked?: boolean }> = ({ value, dateOnly = false, stacked = false }) => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const text = value ? format.date(value, !dateOnly && !stacked, dateOnly) : '';
  if (!value || !text) return <>{t('common.unavailable')}</>;
  if (stacked && !dateOnly) {
    return (
      <time dateTime={value} className="cm-admin-date">
        {text}
        <small>{format.time(value)}</small>
      </time>
    );
  }
  return <time dateTime={value}>{text}</time>;
};

export const CmAdminMoney: React.FC<{ amount: string | number | null | undefined; currency?: string | null }> = ({ amount, currency }) => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  if (amount === null || amount === undefined || amount === '') return <>{t('common.unavailable')}</>;
  return <span className="cm-admin-money">{format.money(amount, currency)}</span>;
};

export const CmAdminUserLink: React.FC<{
  user?: CmAdminUserSummary | null;
  userId?: number | null;
  fallbackKey?: string;
}> = ({ user, userId, fallbackKey = 'common.unavailable' }) => {
  const { t } = useTranslation('cm');
  const id = user?.id ?? userId ?? null;
  if (!id) return <>{t(fallbackKey)}</>;
  const label = user?.username || user?.name || t('admin.userNumber', { id });
  return (
    <Link className="cm-workspace-link cm-admin-user" to={cmAdminUserPath(id)} title={user?.name ?? undefined}>
      {label}
    </Link>
  );
};

const MONEY_FIELDS = ['amount', 'gross', 'commission', 'remaining_amount', 'paid_amount'];
const ROLE_FIELDS = ['role', 'role_type', 'actor_role'];
const METHOD_FIELDS = ['method', 'payment_method'];

/** Key/value details with translated labels (`admin.fields.<key>`), roles, money and lists formatted. */
export const CmAdminKeyValues: React.FC<{ value: Record<string, unknown> | null | undefined; omit?: readonly string[] }> = ({ value, omit = [] }) => {
  const { t } = useTranslation('cm');
  const format = useCmAdminFormat();
  const entries = value && typeof value === 'object'
    ? Object.entries(value).filter(([key, entry]) => !omit.includes(key) && entry !== null && entry !== '')
    : [];
  if (entries.length === 0) return <>{t('common.unavailable')}</>;
  const display = (key: string, entry: unknown): string => {
    if (MONEY_FIELDS.includes(key) && (typeof entry === 'string' || typeof entry === 'number')) return format.money(entry);
    if (ROLE_FIELDS.includes(key) && typeof entry === 'string') return t(`roles.${entry}`, { defaultValue: cmHumanize(entry) });
    if (METHOD_FIELDS.includes(key) && typeof entry === 'string') return t(`wallet.methods.${entry}`, { defaultValue: cmHumanize(entry) });
    if (typeof entry === 'boolean') return t(entry ? 'admin.yes' : 'admin.no');
    if (Array.isArray(entry)) return entry.map((item) => (typeof item === 'string' ? t(`admin.fields.${item}`, { defaultValue: cmHumanize(item) }) : JSON.stringify(item))).join(', ');
    if (typeof entry === 'object') return JSON.stringify(entry);
    return String(entry);
  };
  return (
    <dl className="cm-admin-kv">
      {entries.map(([key, entry]) => (
        <div key={key}>
          <dt>{t(`admin.fields.${key}`, { defaultValue: cmHumanize(key) })}</dt>
          <dd>{display(key, entry)}</dd>
        </div>
      ))}
    </dl>
  );
};

/** "from → to" with each state translated through the resource's state group. */
export const CmAdminStateChange: React.FC<{ resourceType: string; from: string | null; to: string | null }> = ({ resourceType, from, to }) => {
  const { t } = useTranslation('cm');
  const { activityStateGroup } = useCmBootstrap();
  const group = activityStateGroup(resourceType);
  const prefix = group ? CM_ACTIVITY_STATE_GROUP_PREFIX[group] : undefined;
  const label = (state: string | null): string => {
    if (!state) return t('common.unavailable');
    return prefix ? t(`${prefix}.${state}`, { defaultValue: cmHumanize(state) }) : cmHumanize(state);
  };
  if (!from && !to) return <>{t('common.unavailable')}</>;
  return <span className="cm-admin-transition">{from ? `${label(from)} → ${label(to)}` : label(to)}</span>;
};

const ACTIVITY_METADATA_OMIT_PATTERN = /(^from_state$|^to_state$|_id$)/;

function activityDetails(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !ACTIVITY_METADATA_OMIT_PATTERN.test(key)));
}

/** Activity rows shared by the activity log and the user detail page. */
export const CmAdminActivityTable: React.FC<{
  rows: CmAdminActivityRow[];
  showActor?: boolean;
  onResource?: (resourceType: string, resourceId: number) => void;
}> = ({ rows, showActor = true, onResource }) => {
  const { t } = useTranslation('cm');
  return (
    <CmAdminTable label={t('admin.nav.activity')}>
      <thead>
        <tr>
          <th>{t('admin.columnTime')}</th>
          {showActor && <th>{t('admin.activity.actor')}</th>}
          <th>{t('admin.activity.event')}</th>
          <th>{t('admin.activity.metadata')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const resourceLabel = t('admin.activity.resourceLabel', {
            type: t(`admin.activity.resources.${row.resource_type}`, { defaultValue: cmHumanize(row.resource_type) }),
            id: row.resource_id,
          });
          return (
            <tr key={row.id}>
              <td className="cm-admin-nowrap"><CmAdminDate value={row.created_at} stacked /></td>
              {showActor && <td><CmAdminUserLink user={row.actor} userId={row.actor_id} fallbackKey="admin.system" /></td>}
              <td className="cm-admin-event">
                <strong>{t(`admin.activity.actions.${row.action}`, { defaultValue: cmHumanize(row.action) })}</strong>
                <small className="cm-admin-sub">
                  <Link
                    className="cm-workspace-link"
                    to={cmRouteWithQuery(CM_ADMIN_ROUTE.activity, { resource_type: row.resource_type, resource_id: row.resource_id })}
                    onClick={() => onResource?.(row.resource_type, row.resource_id)}
                  >
                    {resourceLabel}
                  </Link>
                  {(row.from_state || row.to_state) && (
                    <> · <CmAdminStateChange resourceType={row.resource_type} from={row.from_state} to={row.to_state} /></>
                  )}
                </small>
              </td>
              <td className="cm-admin-wide"><CmAdminKeyValues value={activityDetails(row.metadata)} /></td>
            </tr>
          );
        })}
      </tbody>
    </CmAdminTable>
  );
};
