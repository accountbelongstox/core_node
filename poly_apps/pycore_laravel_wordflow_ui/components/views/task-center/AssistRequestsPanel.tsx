/**
 * Task Center — ASSIST REQUESTS tab (CoreBook §6).
 *
 * Lists the record-scoped assist_requests rows (a thin per-record request layer
 * on top of the worker-pull assist pool): record_type, source_key/title,
 * request_type, language, status badge, claimed_by. Status filter chips + a
 * "Request assist" button that opens the per-record modal. Reuses the shared
 * StatCard / StatusBadge / persisted-task patterns.
 *
 * Persistent task key: 'laravel.assist-requests'. Header refresh controls arrive
 * from TaskCenter as props (same contract as QueuePanel / WorkersPanel).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import type { AssistRequestItem } from '../../../core/api/modules/ServerManagerAPI';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import {
  RefreshCw,
  XCircle,
  Info,
  Layers,
  Clock,
  PlayCircle,
  CheckCircle,
  Trash2,
  Plus,
  HandHelping,
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { AlertBox, EmptyState, InlineSpinner, LoadingBlock } from '../../common';
import { StatCard, StatusBadge } from './shared';
import AssistRequestModal from './AssistRequestModal';

interface AssistRequestsPanelProps {
  lang: Language;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  /** Bumped by TaskCenter's manual-refresh button -> one immediate fetch. */
  refreshToken: number;
}

const REQUEST_STATUSES = ['pending', 'claimed', 'processing', 'completed', 'failed'] as const;
type StatusFilter = 'all' | (typeof REQUEST_STATUSES)[number];

interface AssistRequestsSnapshot {
  items: AssistRequestItem[];
  total: number;
  timestamp: string;
}

const AssistRequestsPanel: React.FC<AssistRequestsPanelProps> = ({
  lang,
  autoRefresh,
  refreshIntervalSec,
  refreshToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<{ record_type: string; source_key: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // The poll closure must always see the CURRENT status filter.
  const statusFilterRef = useRef<StatusFilter>(statusFilter);
  statusFilterRef.current = statusFilter;

  const fetchSnapshot = (): Promise<AssistRequestsSnapshot | null> => {
    const filter = statusFilterRef.current;
    const params: { per_page: number; status?: string } = { per_page: 100 };
    if (filter !== 'all') params.status = filter;

    return api.serverManager
      .listAssistRequests(params)
      .then((res) => {
        if (!res.success || !res.data) {
          setError(res.error || 'Failed to load assist requests');
          setLoading(false);
          return null;
        }
        setError(null);
        setLoading(false);
        return {
          items: Array.isArray(res.data.items) ? res.data.items : [],
          total: res.data.total ?? 0,
          timestamp: new Date().toLocaleString(),
        };
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load assist requests');
        setLoading(false);
        return null;
      });
  };

  const task = usePersistentTask<AssistRequestsSnapshot>('laravel.assist-requests', {
    intervalMs: refreshIntervalSec * 1000,
    poll: fetchSnapshot,
    reattach: fetchSnapshot,
  });
  const snapshot = task.data;

  // Initial load (idempotent — reuse a live session's data after navigation).
  useEffect(() => {
    if (snapshot) return;
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared header auto-refresh toggle drives the persistent poll loop on/off.
  useEffect(() => {
    if (autoRefresh) {
      if (task.running) task.end();
      task.begin();
    } else if (task.running) {
      task.end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalSec]);

  // Manual refresh from the shared header.
  useEffect(() => {
    if (refreshToken === 0) return;
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const loadSnapshot = () => {
    setLoading(true);
    setError(null);
    fetchSnapshot().then((s) => { if (s) task.set(s); });
  };

  // The list is server-filtered by status, so a filter change must refetch.
  useEffect(() => {
    if (!snapshot) return;
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openCreate = () => {
    setModalRecord(null);
    setModalOpen(true);
  };

  const openCreateForRecord = (row: AssistRequestItem) => {
    setModalRecord({ record_type: row.record_type, source_key: row.source_key });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setNotice(null);
    try {
      const res = await api.serverManager.deleteAssistRequest(id);
      if (res.success) {
        setNotice(`Deleted request #${id}`);
        const s = await fetchSnapshot();
        if (s) task.set(s);
      } else {
        setNotice(`Delete failed: ${res.error || ''}`.trim());
      }
    } catch (err: any) {
      setNotice(`Delete failed: ${err?.message || ''}`.trim());
    } finally {
      setDeletingId(null);
    }
  };

  const onModalSubmitted = (created: number, existing: number) => {
    setModalOpen(false);
    setNotice(`Filed ${created} new request(s), ${existing} already present`);
    loadSnapshot();
  };

  const items = snapshot?.items ?? [];
  const countOf = (s: string) => items.filter((i) => i.status === s).length;

  if (error && !snapshot) {
    return (
      <AlertBox variant="error" className="flex-col items-stretch text-center">
        <p className="font-semibold">Failed to load assist requests</p>
        <p className="text-xs opacity-80 mt-1">{error}</p>
        <button
          onClick={loadSnapshot}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} inline-flex items-center gap-2 mx-auto mt-3`}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </AlertBox>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Transient error / action notice banners */}
      {error && snapshot && <AlertBox variant="error">{error}</AlertBox>}
      {notice && (
        <AlertBox variant="info" icon={false}>
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              {notice}
            </span>
            <button
              onClick={() => setNotice(null)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors shrink-0"
              aria-label="Dismiss notice"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </AlertBox>
      )}

      {loading && !snapshot ? (
        <LoadingBlock label="" className="py-16" />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              icon={Layers}
              iconClass="text-purple-500"
              label="Total"
              value={snapshot ? snapshot.total : '—'}
              valueClass="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={Clock}
              iconClass="text-blue-500"
              label="Pending"
              value={snapshot ? countOf('pending') : '—'}
              valueClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={HandHelping}
              iconClass="text-indigo-500"
              label="Claimed"
              value={snapshot ? countOf('claimed') : '—'}
              valueClass="text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              icon={PlayCircle}
              iconClass="text-amber-500"
              label="Processing"
              value={snapshot ? countOf('processing') : '—'}
              valueClass="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={CheckCircle}
              iconClass="text-green-500"
              label="Completed"
              value={snapshot ? countOf('completed') : '—'}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={XCircle}
              iconClass="text-red-500"
              label="Failed"
              value={snapshot ? countOf('failed') : '—'}
              valueClass="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Filter + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">Filter</span>
            <div className="flex flex-wrap gap-2">
              {(['all', ...REQUEST_STATUSES] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={openCreate}
              className={`${commonClasses.buttonPrimary} ml-auto text-xs px-3 py-1.5 inline-flex items-center gap-1.5`}
            >
              <Plus className="w-3.5 h-3.5" />
              Request assist
            </button>
          </div>

          {/* Requests table */}
          <div className={`${commonClasses.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Record</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Source Key</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Request Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Language</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Claimed By</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 font-mono">
                          {row.record_type}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400"
                        title={row.source_key}
                      >
                        {row.source_key.length > 14 ? `${row.source_key.slice(0, 14)}…` : row.source_key}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                        {row.request_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {row.language || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} kind="queue" />
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400"
                        title={row.claimed_by || undefined}
                      >
                        {row.claimed_by || '—'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => openCreateForRecord(row)}
                          className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                          title="Request more assist for this record"
                        >
                          <Plus className="w-3 h-3" />
                          More
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                          title="Delete request"
                        >
                          {deletingId === row.id ? (
                            <InlineSpinner size={12} />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <EmptyState icon={HandHelping} message="No assist requests" className="py-12" />
            )}
          </div>

          {snapshot && (
            <div className="text-center text-xs text-slate-500 dark:text-slate-400">
              Last updated: {snapshot.timestamp}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <AssistRequestModal
          lang={lang}
          record={modalRecord}
          onClose={() => setModalOpen(false)}
          onSubmitted={onModalSubmitted}
        />
      )}
    </div>
  );
};

export default AssistRequestsPanel;
