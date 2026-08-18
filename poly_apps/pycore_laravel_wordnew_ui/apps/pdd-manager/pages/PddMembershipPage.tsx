/**
 * PddMembershipPage — expiry management. Lists memberships expiring within a
 * configurable window (GET /memberships/expiring?days=N) and bulk-extends the
 * selected rows by re-using POST /users/{id}/membership { extend_days }.
 * Strings via the `pdd` namespace.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, CalendarClock, Loader2 } from 'lucide-react';
import { api } from '@/apps/pdd-manager/api';
import type { PddUserAdmin } from '@/apps/pdd-manager/api';

const WINDOWS = [3, 7, 14, 30];

const PddMembershipPage: React.FC = () => {
  const { t } = useTranslation('pdd');
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<PddUserAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [extendBy, setExtendBy] = useState('30');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.pddAdmin.listExpiring(days);
      setRows(data);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const bulkExtend = async () => {
    if (selected.size === 0 || !extendBy) return;
    setBusy(true);
    const ids: number[] = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      try {
        await api.pddAdmin.setMembership(id, { extend_days: Number(extendBy) });
        ok += 1;
      } catch { /* continue; partial success is acceptable */ }
    }
    setNotice(t('membership.extendDone', { count: ok }));
    window.setTimeout(() => setNotice(null), 3000);
    setBusy(false);
    await load();
  };

  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('membership.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('membership.subtitle')}</p>
      </header>

      {notice && (
        <div className="mb-4 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-4 py-3 text-sm">{notice}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-slate-500">{t('membership.windowLabel')}:</span>
          <div className="flex gap-1">
            {WINDOWS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {d} {t('common.days')}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <span className="text-sm text-slate-500">{selected.size} {t('membership.selected')}</span>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-slate-500">{t('membership.extendBy')}:</label>
          <input
            type="number"
            value={extendBy}
            onChange={(e) => setExtendBy(e.target.value)}
            className="w-24 px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            onClick={bulkExtend}
            disabled={busy || selected.size === 0 || !extendBy}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('membership.bulkExtend')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-4 py-2.5 font-medium">{t('membership.colUsername')}</th>
                <th className="px-4 py-2.5 font-medium">{t('membership.colPackage')}</th>
                <th className="px-4 py-2.5 font-medium">{t('membership.colValidUntil')}</th>
                <th className="px-4 py-2.5 font-medium">{t('membership.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{loading ? t('common.loading') : t('membership.empty')}</td></tr>
              ) : rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="rounded" /></td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{u.username}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{u.package_name}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{u.valid_until || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.is_expired
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                    }`}>
                      {u.is_expired ? t('users.statusExpired') : t('users.statusActive')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PddMembershipPage;
