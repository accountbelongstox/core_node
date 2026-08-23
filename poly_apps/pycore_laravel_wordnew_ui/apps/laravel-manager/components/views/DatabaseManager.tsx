import React, { useState, useMemo } from 'react';
import { api, DbConnectionInfo } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock } from '../common';
import { CenteredPage, CenteredTabBar } from '@/apps/laravel-manager/components/common/CenteredPageLayout';
import { useApiResource } from '@/apps/laravel-manager/hooks';
import { DatabaseZap, Layers } from 'lucide-react';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { DataSyncTab } from './database-manager/DataSyncTab';
import { StatusStrip, TablesTab } from './database-manager/TablesTab';
import { ImportExportTab } from './database-manager/ImportExportTab';
import { BackupTab } from './database-manager/BackupTab';
import { CredentialsTab } from './database-manager/CredentialsTab';

interface DatabaseManagerProps {
  lang: Language;
}

type TabKey = 'tables' | 'io' | 'backup' | 'sync' | 'credentials';

const DatabaseManager: React.FC<DatabaseManagerProps> = () => {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('tables');
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'tables', label: t('dbSync.tabs.tables') },
    { key: 'io', label: t('dbSync.tabs.io') },
    { key: 'backup', label: t('dbSync.tabs.backup') },
    { key: 'sync', label: t('dbSync.tabs.sync') },
    { key: 'credentials', label: t('dbSync.tabs.credentials') }
  ];

  const {
    data: connectionsData,
    loading,
    error,
    refresh: loadConnections
  } = useApiResource<DbConnectionInfo[]>(() => api.databaseManager.getConnections(), {
    initialData: [],
    onSuccess: (list) =>
      setSelectedKey((prev) => {
        if (prev && list.some((c) => c.key === prev)) return prev;
        const main = list.find((c) => c.is_main);
        return main?.key ?? list[0]?.key ?? '';
      })
  });
  const connections = connectionsData ?? [];

  const selected = useMemo(
    () => connections.find((c) => c.key === selectedKey) ?? null,
    [connections, selectedKey]
  );

  if (loading) {
    return <LoadingBlock full size="lg" label="Loading connections…" />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={loadConnections}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <CenteredPage className="h-full flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DatabaseZap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Database Manager</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Status, tables, import/export and backups across connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className={`${commonClasses.select}`}
          >
            {connections.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name} {c.is_main ? '(main)' : '(app)'} · {c.driver}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <CenteredTabBar items={tabs.map((item) => ({ id: item.key, label: item.label }))} activeId={tab} onChange={(id) => setTab(id as TabKey)} />
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'sync' ? (
          <DataSyncTab />
        ) : !selected ? (
          <div className="text-slate-500 dark:text-slate-400 py-6">No connection selected</div>
        ) : (
          <>
            {tab === 'tables' && (
              <div key={selected.key} className="space-y-3">
                <StatusStrip connection={selected} />
                <TablesTab connection={selected} />
              </div>
            )}
            {tab === 'io' && <ImportExportTab key={selected.key} connection={selected} />}
            {tab === 'backup' && <BackupTab key={selected.key} connection={selected} />}
            {tab === 'credentials' && <CredentialsTab key={selected.key} connection={selected} />}
          </>
        )}
      </div>
    </CenteredPage>
  );
};

export default DatabaseManager;
