import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmAdminKycItem, CmAdminOverview, CmAdminUser } from '../api/CmApiTypes';

export const CmAdminOverviewPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [overview, setOverview] = useState<CmAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminOverview();
    if (response.success && response.data) {
      setOverview(response.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards: { key: string; value: number | string | undefined }[] = overview ? [
    { key: 'admin.metrics.users', value: overview.users_total },
    { key: 'admin.metrics.roleHolders', value: overview.codeMart_role_holders },
    { key: 'admin.metrics.projects', value: overview.projects_total },
    { key: 'admin.metrics.tasks', value: overview.tasks_total },
    { key: 'admin.metrics.kycPending', value: overview.kyc_pending },
    { key: 'admin.metrics.refundsPending', value: overview.refunds_pending },
    { key: 'admin.metrics.depositsPending', value: overview.deposits_pending },
  ] : [];

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.overview')}</h1>
        <button type="button" className="cm-workspace-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <section className="cm-metric-grid">
          {cards.map((card) => (
            <article key={card.key} className="cm-metric-card" data-tone="blue">
              <div><strong>{card.value ?? t('common.unavailable')}</strong><small>{t(card.key)}</small></div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export const CmAdminUsersPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [users, setUsers] = useState<CmAdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (keyword: string): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminUsers(keyword);
    if (response.success && response.data) {
      setUsers(response.data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  const setRoleStatus = async (userId: number, roleType: string, status: string): Promise<void> => {
    const response = await cmApi.adminSetRoleStatus(userId, roleType, status);
    setNotice(response.success ? t('admin.roleUpdated') : t('admin.actionFailed'));
    await load(search);
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.users')}</h1>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      <section className="cm-marketplace-toolbar">
        <label>
          <span>{t('admin.searchUsers')}</span>
          <div>
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void load(search);
              }}
            />
          </div>
        </label>
        <button type="button" className="cm-workspace-button" onClick={() => void load(search)}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </section>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <table className="cm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.columnUser')}</th>
              <th>{t('admin.columnEmail')}</th>
              <th>{t('admin.columnLevel')}</th>
              <th>{t('admin.columnRoles')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.email ?? t('common.unavailable')}</td>
                <td>{user.rolelevel}</td>
                <td>
                  {Object.entries(user.roles).map(([role, status]) => (
                    <span key={role} className="cm-admin-role">
                      <span className="cm-status" data-status={status}>{t(`roles.${role}`)}: {t(`states.role.${status}`)}</span>
                      <select
                        value={status}
                        onChange={(event) => void setRoleStatus(user.id, role, event.target.value)}
                        aria-label={t('admin.changeRoleStatus')}
                      >
                        {['pending', 'active', 'suspended', 'rejected'].map((option) => (
                          <option key={option} value={option}>{t(`states.role.${option}`)}</option>
                        ))}
                      </select>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export const CmAdminKycPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [items, setItems] = useState<CmAdminKycItem[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: string): Promise<void> => {
    setLoading(true);
    const response = await cmApi.adminKycList(nextStatus);
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  const review = async (kycId: number, approved: boolean): Promise<void> => {
    const response = approved
      ? await cmApi.adminKycApprove(kycId)
      : await cmApi.adminKycReject(kycId, '');
    setNotice(response.success ? t('admin.kycReviewed') : t('admin.actionFailed'));
    await load(status);
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('admin.badge')}</span>
        <h1>{t('admin.nav.kyc')}</h1>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('admin.filterStatus')}>
          {['pending', 'approved', 'rejected'].map((option) => (
            <option key={option} value={option}>{t(`states.kyc.${option}`)}</option>
          ))}
        </select>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="cm-contract-note">{t('admin.noKyc')}</p>
      ) : (
        <section className="cm-card-list">
          {items.map((item) => (
            <article key={item.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2>{item.real_name} (#{item.id}, user {item.user_id})</h2>
                <div className="cm-record-card__meta">
                  <span>{item.identity_type}</span>
                  <span className="cm-status" data-status={item.verification_status}>{t(`states.kyc.${item.verification_status}`)}</span>
                  <span>{item.submitted_at ? item.submitted_at.slice(0, 10) : ''}</span>
                </div>
              </div>
              {item.verification_status === 'pending' && (
                <div className="cm-record-card__actions">
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => void review(item.id, true)}>
                    <Check aria-hidden="true" /> {t('admin.approve')}
                  </button>
                  <button type="button" className="cm-workspace-button is-danger" onClick={() => void review(item.id, false)}>
                    <X aria-hidden="true" /> {t('admin.reject')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};
