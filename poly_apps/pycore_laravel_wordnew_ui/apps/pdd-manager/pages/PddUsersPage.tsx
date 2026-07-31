/**
 * PddUsersPage — searchable / paginated user table with a row-detail drawer.
 * The drawer edits membership (tier / extend days / limits), adjusts points and
 * enables/disables the account. All admin calls go through api.pddAdmin. Strings
 * via the `pdd` namespace.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, X, Power, Coins, BadgeCheck, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '@/apps/pdd-manager/api';
import type {
  PddUserAdmin, PddUserDetail, PddSetMembershipPayload,
} from '@/apps/pdd-manager/api';

const PER_PAGE = 20;

function StatusBadge({ user, t }: { user: PddUserAdmin; t: (k: string) => string }) {
  if (user.disabled) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-600 dark:text-slate-300">{t('users.statusDisabled')}</span>;
  }
  if (user.is_expired) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-600 dark:text-rose-300">{t('users.statusExpired')}</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">{t('users.statusActive')}</span>;
}

const PddUsersPage: React.FC = () => {
  const { t } = useTranslation('pdd');
  const [rows, setRows] = useState<PddUserAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.pddAdmin.listUsers({
        search: search || undefined,
        page,
        per_page: PER_PAGE,
        expired: expiredOnly || undefined,
      });
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, page, expiredOnly]);

  useEffect(() => { void load(); }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const doSearch = () => { setPage(1); setSearch(searchInput.trim()); };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('users.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('users.subtitle')}</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            placeholder={t('users.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <button onClick={doSearch} className="px-3 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">
          {t('common.search')}
        </button>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={expiredOnly} onChange={(e) => { setPage(1); setExpiredOnly(e.target.checked); }} className="rounded" />
          {t('users.expiredOnly')}
        </label>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">{t('users.colId')}</th>
                <th className="px-4 py-2.5 font-medium">{t('users.colUsername')}</th>
                <th className="px-4 py-2.5 font-medium">{t('users.colPackage')}</th>
                <th className="px-4 py-2.5 font-medium">{t('users.colValidUntil')}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t('users.colPoints')}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t('users.colAccounts')}</th>
                <th className="px-4 py-2.5 font-medium">{t('users.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{loading ? t('common.loading') : t('users.empty')}</td></tr>
              ) : rows.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <td className="px-4 py-2.5 text-slate-500">{u.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{u.username}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{u.package_name}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{u.valid_until || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{u.points}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{u.pdd_accounts_count}</td>
                  <td className="px-4 py-2.5"><StatusBadge user={u} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          <span>{t('common.page')} {page} {t('common.of')} {lastPage} · {total}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {selectedId !== null && (
        <UserDrawer
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
};

// --- Row detail drawer -------------------------------------------------------

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30';
const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

const UserDrawer: React.FC<{ userId: number; onClose: () => void; onChanged: () => void }> = ({ userId, onClose, onChanged }) => {
  const { t } = useTranslation('pdd');
  const [detail, setDetail] = useState<PddUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Membership form
  const [pkg, setPkg] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [extendDays, setExtendDays] = useState('');
  const [maxOrders, setMaxOrders] = useState('');
  const [maxAccounts, setMaxAccounts] = useState('');
  // Points form
  const [pointsDelta, setPointsDelta] = useState('');
  const [pointsReason, setPointsReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const d = await api.pddAdmin.getUser(userId);
    setDetail(d);
    if (d) {
      setPkg(d.user.package_name || '');
      setValidUntil(d.user.valid_until || '');
      setMaxOrders(String(d.user.max_orders));
      setMaxAccounts(String(d.user.max_pdd_accounts));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2500); };

  const saveMembership = async () => {
    setBusy(true);
    try {
      const payload: PddSetMembershipPayload = {};
      if (pkg) payload.package_name = pkg;
      if (validUntil) payload.valid_until = validUntil;
      if (extendDays) payload.extend_days = Number(extendDays);
      if (maxOrders !== '') payload.max_orders = Number(maxOrders);
      if (maxAccounts !== '') payload.max_pdd_accounts = Number(maxAccounts);
      await api.pddAdmin.setMembership(userId, payload);
      flash(t('users.membershipSaved'));
      setExtendDays('');
      await load();
      onChanged();
    } catch (e: any) {
      flash(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const adjustPoints = async () => {
    if (!pointsDelta) return;
    setBusy(true);
    try {
      const res = await api.pddAdmin.adjustPoints(userId, Number(pointsDelta), pointsReason);
      flash(t('users.pointsSaved'));
      setPointsDelta('');
      setPointsReason('');
      setDetail((d) => (d ? { ...d, user: { ...d.user, points: res.points } } : d));
      onChanged();
    } catch (e: any) {
      flash(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const toggleDisabled = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      if (detail.user.disabled) {
        await api.pddAdmin.enableUser(userId);
        flash(t('users.enabled'));
      } else {
        await api.pddAdmin.disableUser(userId);
        flash(t('users.disabled'));
      }
      await load();
      onChanged();
    } catch (e: any) {
      flash(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('users.detailTitle')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        {notice && (
          <div className="mx-5 mt-3 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-3 py-2 text-sm">{notice}</div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          {loading || !detail ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}</div>
          ) : (
            <>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{detail.user.username}</div>
                <div className="text-xs text-slate-400">#{detail.user.id} · {detail.user.created_at}</div>
              </div>

              {/* Usage */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('users.usage')}</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{detail.usage.batch_orders}</div>
                    <div className="text-[11px] text-slate-400">{t('users.batchOrders')}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{detail.usage.bind_count}</div>
                    <div className="text-[11px] text-slate-400">{t('users.bindCount')}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{detail.user.points}</div>
                    <div className="text-[11px] text-slate-400">{t('users.colPoints')}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{t('users.lastLogin')}: {detail.usage.last_login || '—'}</div>
              </section>

              {/* Membership edit */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-indigo-500" /> {t('users.editMembership')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('users.package')}</label>
                    <input value={pkg} onChange={(e) => setPkg(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('users.validUntil')}</label>
                      <input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} placeholder="YYYY-MM-DD" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('users.extendDays')}</label>
                      <input type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('users.maxOrders')}</label>
                      <input type="number" value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('users.maxAccounts')}</label>
                      <input type="number" value={maxAccounts} onChange={(e) => setMaxAccounts(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <button onClick={saveMembership} disabled={busy} className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                    {busy ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </section>

              {/* Points adjust */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> {t('users.adjustPoints')}</h3>
                <div className="space-y-3">
                  <input type="number" value={pointsDelta} onChange={(e) => setPointsDelta(e.target.value)} placeholder={t('users.pointsDelta')} className={inputCls} />
                  <input value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} placeholder={t('users.pointsReason')} className={inputCls} />
                  <button onClick={adjustPoints} disabled={busy || !pointsDelta} className="w-full py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition">
                    {t('common.apply')}
                  </button>
                </div>
              </section>

              {/* Enable / disable */}
              <button onClick={toggleDisabled} disabled={busy} className={`w-full py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 transition ${
                detail.user.disabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}>
                <Power className="w-4 h-4" /> {detail.user.disabled ? t('users.enable') : t('users.disable')}
              </button>

              {/* Recharges */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('users.recharges')}</h3>
                {detail.recharges.length === 0 ? (
                  <div className="text-xs text-slate-400">{t('recharge.empty')}</div>
                ) : (
                  <div className="space-y-1.5">
                    {detail.recharges.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                        <span className="text-slate-600 dark:text-slate-300">{r.created_at} · ¥{r.amount}</span>
                        <span className="text-slate-400">{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default PddUsersPage;
