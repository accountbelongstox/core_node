import React, { useState } from 'react';
import { api, DbConnectionInfo, ExportFormat, ImportMode } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../../admin/Modal';
import { useToast } from '../../admin';
import { AlertBox, Field } from '../../common';
import { Download, Upload } from 'lucide-react';

export const ImportExportTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const toast = useToast();
  const [table, setTable] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [importFormat, setImportFormat] = useState<ExportFormat>('csv');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);

  const { data: tables, loading } = useApiResource<DbTableInfo[]>(
    () => api.databaseManager.getTables(connection.key),
    {
      deps: [connection.key],
      initialData: [],
      onSuccess: (list) =>
        setTable((prev) => (prev && list.some((t) => t.name === prev) ? prev : list[0]?.name ?? ''))
    }
  );
  const tableList = tables ?? [];

  const handleExport = async () => {
    if (!table) return;
    setBusy(true);
    // Export downloads via raw fetch (binary), so it bypasses the automatic
    // BaseAPI request logging — log the operation explicitly.
    logInfo('db-manager', `Export ${connection.key}.${table} as ${exportFormat.toUpperCase()}…`);
    try {
      await api.databaseManager.exportTable(table, connection.key, exportFormat);
      logSuccess('db-manager', `Export ${connection.key}.${table} done`);
      toast.success(`Exported ${table} as ${exportFormat.toUpperCase()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      logError('db-manager', `Export ${connection.key}.${table} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!table || !file) return;
    setBusy(true);
    setConfirmImport(false);
    logInfo('db-manager', `Import ${file.name} → ${connection.key}.${table} (${importFormat}, ${importMode})…`);
    try {
      const result = await api.databaseManager.importTable(
        table,
        connection.key,
        file,
        importFormat,
        importMode
      );
      logSuccess('db-manager', `Import ${connection.key}.${table}: ${result.imported} imported, ${result.skipped} skipped`);
      toast.success(`Imported ${result.imported}, skipped ${result.skipped}`);
      setFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      logError('db-manager', `Import ${connection.key}.${table} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading tables…" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Export */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Export table</h3>
        </div>
        <Field label="Table">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className={`${commonClasses.select} w-full`}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy || !table}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>

      {/* Import */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Import file</h3>
        </div>
        <Field label="Table">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as ExportFormat)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </Field>
          <Field label="Mode">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </select>
          </Field>
        </div>
        <Field label="File">
          <input
            type="file"
            accept={importFormat === 'csv' ? '.csv' : '.json'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${commonClasses.input} w-full`}
          />
        </Field>
        <button
          type="button"
          onClick={() => setConfirmImport(true)}
          disabled={busy || !table || !file}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
      </div>

      <Modal
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        title="Confirm import"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmImport(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runImport}
              className={`${commonClasses.button} ${
                importMode === 'replace'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : commonClasses.buttonPrimary
              }`}
            >
              {importMode === 'replace' ? 'Replace & import' : 'Import'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Import <strong>{file?.name}</strong> ({importFormat.toUpperCase()}) into{' '}
          <strong>{table}</strong> on <strong>{connection.name}</strong> in{' '}
          <strong>{importMode}</strong> mode.
          {importMode === 'replace' && (
            <span className="block mt-2 text-red-600 dark:text-red-400">
              Replace mode clears existing rows in this table first.
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Backup tab ───────────────────────────────
