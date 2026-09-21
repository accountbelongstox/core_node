import React, { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, Inbox, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

interface MarketplaceResult {
  tasks: CmTask[];
  total: number;
}

function parseMarketplace(data: unknown): MarketplaceResult {
  if (!data || typeof data !== 'object') return { tasks: [], total: 0 };
  const source = data as { tasks?: unknown; pagination?: { total?: unknown } };
  const tasks = Array.isArray(source.tasks) ? (source.tasks as CmTask[]) : [];
  const total = typeof source.pagination?.total === 'number' ? source.pagination.total : tasks.length;
  return { tasks, total };
}

export const CmMarketplacePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, refresh } = useCmBootstrap();
  const canAccept = hasCapability('task.browse');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<MarketplaceResult>({ tasks: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (keyword: string): Promise<void> => {
    setLoading(true);
    const response = await cmApi.browseMarketplace(keyword ? { search: keyword } : undefined);
    if (response.success) {
      setResult(parseMarketplace(response.data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  const accept = async (taskId: number): Promise<void> => {
    setAcceptingId(taskId);
    setNotice(null);
    const response = await cmApi.acceptTask(taskId);
    setNotice(response.success ? t('marketplace.accepted') : t('marketplace.acceptFailed'));
    setAcceptingId(null);
    await load(search);
    await refresh();
  };

  const visibleTasks = search
    ? result.tasks.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
        || (task.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : result.tasks;

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('marketplace.eyebrow')}</span>
        <h1>{t('nav.marketplace')}</h1>
        <p>{t('marketplace.description')}</p>
      </header>
      <section className="cm-marketplace-toolbar">
        <label>
          <span>{t('marketplace.searchLabel')}</span>
          <div>
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void load(search);
              }}
              placeholder={t('marketplace.searchPlaceholder')}
            />
          </div>
        </label>
        <button type="button" className="cm-workspace-button" onClick={() => void load(search)}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </section>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : visibleTasks.length === 0 ? (
        <section className="cm-marketplace-empty">
          <Inbox aria-hidden="true" />
          <h2>{t('marketplace.emptyTitle')}</h2>
          <p>{t('marketplace.emptyBody')}</p>
        </section>
      ) : (
        <section className="cm-card-list">
          {visibleTasks.map((task) => (
            <article key={task.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2>{task.title}</h2>
                <p>{task.description}</p>
                <div className="cm-record-card__meta">
                  <span><CircleDollarSign aria-hidden="true" /> {task.budget_allocation ?? t('common.unavailable')}</span>
                  <span className="cm-status" data-status={task.status}>{t(`states.task.${task.status}`)}</span>
                </div>
              </div>
              {canAccept && (
                <button
                  type="button"
                  className="cm-workspace-button is-primary"
                  disabled={acceptingId === task.id}
                  onClick={() => void accept(task.id)}
                >
                  {acceptingId === task.id ? t('common.loading') : t('marketplace.accept')}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default CmMarketplacePage;
