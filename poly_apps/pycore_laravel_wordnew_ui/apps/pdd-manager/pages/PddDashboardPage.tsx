/**
 * PddDashboardPage — overview stat cards (GET /stats) + an expiring-soon table
 * (GET /memberships/expiring?days=7). Nexus glass surfaces; all strings via the
 * `pdd` i18n namespace.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, UserCheck, CalendarClock, DollarSign, TrendingUp, ShoppingBag,
  RefreshCw, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { api } from '@/apps/pdd-manager/api';
import type { PddStats, PddUserAdmin } from '@/apps/pdd-manager/api';

interface StatCard {
  key: keyof PddStats;
  labelKey: string;
  Icon: LucideIcon;
  accent: string;
  money?: boolean;
}

const CARDS: StatCard[] = [
  { key: 'users_total', labelKey: 'dashboard.usersTotal', Icon: Users, accent: 'from-indigo-500 to-violet-500' },
  { key: 'users_active', labelKey: 'dashboard.usersActive', Icon: UserCheck, accent: 'from-emerald-500 to-teal-500' },
  { key: 'expiring_7d', labelKey: 'dashboard.expiring7d', Icon: CalendarClock, accent: 'from-amber-500 to-orange-500' },
  { key: 'revenue_total', labelKey: 'dashboard.revenueTotal', Icon: DollarSign, accent: 'from-sky-500 to-cyan-500', money: true },
  { key: 'revenue_30d', labelKey: 'dashboard.revenue30d', Icon: TrendingUp, accent: 'from-rose-500 to-pink-500', money: true },
  { key: 'pdd_accounts_total', labelKey: 'dashboard.pddAccounts', Icon: ShoppingBag, accent: 'from-fuchsia-500 to-purple-500' },
];

function fmtMoney(n: number): string {
  return `¥${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PddDashboardPage: React.FC = () => {
  const { t } = useTranslation('pdd');
  const [stats, setStats] = useState<PddStats | null>(null);
  const [expiring, setExpiring] = useState<PddUserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, e] = await Promise.all([
        api.pddAdmin.getStats(),
        api.pddAdmin.listExpiring(7),
      ]);
      setStats(s);
      setExpiring(e);
      if (!s) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4" /> {t('common.unreachable')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.Icon;
          const raw = stats ? stats[c.key] : 0;
          const value = c.money ? fmtMoney(raw as number) : (raw as number).toLocaleString();
          return (
            <div
              key={c.key}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} text-white flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '—' : value}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(c.labelKey)}</div>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.expiringTitle')}</h2>
        </div>
        {expiring.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">{t('dashboard.expiringEmpty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-2.5 font-medium">{t('users.colUsername')}</th>
                  <th className="px-5 py-2.5 font-medium">{t('users.colPackage')}</th>
                  <th className="px-5 py-2.5 font-medium">{t('users.colValidUntil')}</th>
                  <th className="px-5 py-2.5 font-medium">{t('users.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-slate-800 dark:text-slate-200">{u.username}</td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{u.package_name}</td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{u.valid_until || '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
        )}
      </section>
    </div>
  );
};

export default PddDashboardPage;
