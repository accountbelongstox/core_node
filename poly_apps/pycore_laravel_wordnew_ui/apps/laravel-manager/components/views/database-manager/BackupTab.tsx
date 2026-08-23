import React, { useState } from 'react';
import { api, DbConnectionInfo, DbBackup } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../../admin/Modal';
import { useToast } from '../../admin';
import { LoadingBlock, InlineSpinner, AlertBox, EmptyState } from '../../common';
import { useApiResource } from '@/apps/laravel-manager/hooks';
import { Download, Save, RotateCcw, Trash2, HardDrive } from 'lucide-react';

function backupMechanism(driver: string): string {
  switch (driver) {
    case 'pgsql':
      return 'pg_dump';
    case 'mysql':
      return 'mysqldump';
    case 'sqlite':
      return 'file-copy';
    default:
      return driver;
  }
}

export const BackupTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DbBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbBackup | null>(null);

  const { data: backupsData, loading, refresh: load } = useApiResource<DbBackup[]>(
    () => api.databaseManager.getBackups(connection.key),
    { deps: [connection.key], initialData: [] }
  );
  const backups = backupsData ?? [];

  const handleCreate = async () => {
    setBusy(true);
    logInfo('db-manager', `Creating backup of ${connection.key} via ${backupMechanism(connection.driver)}…`);
    try {
      await api.databaseManager.createBackup(connection.key);
      logSuccess('db-manager', `Backup of ${connection.key} created`);
      toast.success(`Backup created (${backupMechanism(connection.driver)})`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backup failed';
      logError('db-manager', `Backup of ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setBusy(true);
    logInfo('db-manager', `Restoring backup ${target.file}…`);
    try {
      const res = await api.databaseManager.restoreBackup(target.id);
      if (res.success) {
        logSuccess('db-manager', `Restore of ${target.file} done`);
        toast.success(res.message || 'Backup restored');
      } else {
        logError('db-manager', `Restore of ${target.file} failed — ${res.message || 'unknown error'}`);
        toast.error(res.message || 'Restore failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Restore failed';
      logError('db-manager', `Restore of ${target.file} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusy(true);
    try {
      const res = await api.databaseManager.deleteBackup(target.id);
      if (res.success) {
        logSuccess('db-manager', `Backup ${target.file} deleted`);
        toast.success('Backup deleted');
        load();
      } else {
        logError('db-manager', `Delete of backup ${target.file} failed`);
        toast.error('Delete failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      logError('db-manager', `Delete of backup ${target.file} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (b: DbBackup) => {
    // Raw-fetch binary download — bypasses BaseAPI logging, log explicitly.
    logInfo('db-manager', `Downloading backup ${b.file}…`);
    try {
      await api.databaseManager.downloadBackup(b.id, b.file);
      logSuccess('db-manager', `Download of ${b.file} started`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      logError('db-manager', `Download of ${b.file} failed — ${msg}`);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mechanism for <strong>{connection.name}</strong>:{' '}
          <StatusBadge
            status={backupMechanism(connection.driver)}
            tone={driverTone(connection.driver)}
            withDot={false}
          />
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            Create backup
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading backups…" />
      ) : backups.length === 0 ? (
        <div className={commonClasses.card}>
          <EmptyState icon={Save} message="No backups yet" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700/50">
                {['File', 'Driver', 'Connection', 'Size', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={b.file}>
                    {b.file}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.driver} tone={driverTone(b.driver)} withDot={false} />
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{b.connection}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {b.size_human ?? `${b.size_bytes} B`}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{b.created_at}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Restore"
                        onClick={() => setRestoreTarget(b)}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Download"
                        onClick={() => handleDownload(b)}
                        className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(b)}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore confirm */}
      <Modal
        isOpen={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title="Restore backup"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setRestoreTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className={`${commonClasses.button} bg-amber-600 hover:bg-amber-700 text-white`}
            >
              Restore
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Restore <strong>{restoreTarget?.file}</strong> onto <strong>{connection.name}</strong>?
          <span className="block mt-2 text-red-600 dark:text-red-400">
            This overwrites the current database with the backup contents.
          </span>
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete backup"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white`}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Permanently delete <strong>{deleteTarget?.file}</strong>?
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Credentials tab ───────────────────────────────
