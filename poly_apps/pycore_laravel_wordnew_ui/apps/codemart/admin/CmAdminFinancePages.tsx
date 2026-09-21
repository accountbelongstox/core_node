import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmAdminDeposit, CmAdminRefund, CmProject } from '../api/CmApiTypes';

export const CmAdminDepositsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [items, setItems] = useState<CmAdminDeposit[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: string): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminDeposits(nextStatus);
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  const confirm = async (depositId: number): Promise<void> => {
    const response = await cmApi.adminConfirmDeposit(depositId);
    setNotice(response.success ? t('admin.depositConfirmed') : t('admin.actionFailed'));
    await load(status);
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.deposits')}</h1>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('admin.filterStatus')}>
          <option value="">{t('admin.allStatuses')}</option>
          {['pending', 'paid'].map((option) => (
            <option key={option} value={option}>{t(`states.deposit.${option}`)}</option>
          ))}
        </select>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="cm-contract-note">{t('admin.noDeposits')}</p>
      ) : (
        <table className="cm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.columnRole')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.columnMethod')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.user_id}</td>
                <td>{t(`roles.${item.role_type}`)}</td>
                <td>{item.amount}</td>
                <td>{item.payment_method}</td>
                <td><span className="cm-status" data-status={item.status}>{t(`states.deposit.${item.status}`)}</span></td>
                <td>
                  {item.status === 'pending' && (
                    <button type="button" className="cm-workspace-button is-primary" onClick={() => void confirm(item.id)}>
                      <Check aria-hidden="true" /> {t('admin.confirmDeposit')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export const CmAdminRefundsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [items, setItems] = useState<CmAdminRefund[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminRefunds();
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.refunds')}</h1>
        <button type="button" className="cm-workspace-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="cm-contract-note">{t('admin.noRefunds')}</p>
      ) : (
        <table className="cm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.columnPayment')}</th>
              <th>{t('admin.columnAmount')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.columnReason')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.payment_id}</td>
                <td>{item.amount}</td>
                <td><span className="cm-status" data-status={item.status}>{item.status}</span></td>
                <td>{item.reason ?? t('common.unavailable')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export const CmAdminProjectsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [items, setItems] = useState<CmProject[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextStatus: string): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminProjects(nextStatus);
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.projects')}</h1>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('admin.filterStatus')}>
          <option value="">{t('admin.allStatuses')}</option>
          {['draft', 'proposal_review', 'funding_pending', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'].map((option) => (
            <option key={option} value={option}>{t(`states.project.${option}`)}</option>
          ))}
        </select>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="cm-contract-note">{t('admin.noProjects')}</p>
      ) : (
        <table className="cm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.columnTitle')}</th>
              <th>{t('admin.columnClient')}</th>
              <th>{t('admin.columnBudget')}</th>
              <th>{t('admin.columnStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.title}</td>
                <td>{item.client_id}</td>
                <td>{item.currency ?? ''} {item.budget ?? t('common.unavailable')}</td>
                <td><span className="cm-status" data-status={item.status}>{t(`states.project.${item.status}`)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};
