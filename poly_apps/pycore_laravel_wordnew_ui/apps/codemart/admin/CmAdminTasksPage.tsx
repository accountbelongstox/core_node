import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmProjectPath } from '../components/public-home/cmPublicRoutes';
import { CmListState } from '../components/workspace/CmStateViews';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { cmAdminApi } from './CmAdminApi';
import {
  CmAdminDate,
  CmAdminMoney,
  CmAdminSearch,
  CmAdminSelect,
  CmAdminTable,
  CmAdminToolbar,
  CmAdminUserLink,
  useCmAdminList,
  useCmAdminParam,
} from './CmAdminShared';

/** Read-only oversight of every task across projects. */
export const CmAdminTasksPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const [projectId, setProjectId] = useState(useCmAdminParam('project_id'));
  const filters = useMemo(() => ({ status, search, project_id: projectId }), [status, search, projectId]);
  const list = useCmAdminList((query) => cmAdminApi.tasks(query), filters);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader variant="admin" titleKey="admin.nav.tasks" purposeKey="admin.purpose.tasks" onRefresh={() => void list.reload()} />
      <CmAdminToolbar>
        <CmAdminSearch labelKey="admin.searchTasks" value={search} onApply={setSearch} />
        <CmAdminSelect
          labelKey="admin.filterStatus"
          value={status}
          onChange={setStatus}
          options={states('task')}
          optionLabel={(option) => t(`states.task.${option}`, { defaultValue: option })}
        />
        <CmAdminSearch labelKey="admin.tasks.projectId" value={projectId} onApply={setProjectId} icon={false} inputMode="numeric" />
      </CmAdminToolbar>
      <CmListState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyKey="admin.noTasks" onRetry={list.retryable ? () => void list.reload() : undefined}>
        <CmAdminTable label={t('admin.nav.tasks')}>
          <thead>
            <tr>
              <th>{t('admin.columnId')}</th>
              <th>{t('admin.columnTitle')}</th>
              <th>{t('admin.tasks.project')}</th>
              <th>{t('admin.tasks.assignee')}</th>
              <th>{t('admin.tasks.priority')}</th>
              <th>{t('admin.columnBudget')}</th>
              <th>{t('admin.columnStatus')}</th>
              <th>{t('admin.tasks.due')}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{t('admin.recordNumber', { id: item.id })}</td>
                <td className="cm-admin-wide"><strong className="cm-admin-cell-title">{item.title}</strong></td>
                <td>
                  {item.project_id ? (
                    <Link className="cm-workspace-link" to={cmProjectPath(item.project_id)}>{item.project_title || t('admin.recordNumber', { id: item.project_id })}</Link>
                  ) : t('common.unavailable')}
                </td>
                <td><CmAdminUserLink user={item.assignee} fallbackKey="admin.tasks.unassigned" /></td>
                <td>{item.priority ? t(`projectDetail.priorities.${item.priority}`, { defaultValue: item.priority }) : t('common.unavailable')}</td>
                <td><CmAdminMoney amount={item.budget_allocation} currency={item.currency} /></td>
                <td><CmStatusBadge status={item.status} prefix="states.task" /></td>
                <td className="cm-admin-nowrap"><CmAdminDate value={item.due_date} dateOnly /></td>
              </tr>
            ))}
          </tbody>
        </CmAdminTable>
      </CmListState>
      <CmPager variant="admin" page={list.page} totalPages={list.totalPages} total={list.total} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </main>
  );
};

export default CmAdminTasksPage;
