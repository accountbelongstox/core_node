/**
 * Shell home — cross-end summary. One card per end with a live-ish health dot and
 * an entry link. Pycore health is checked through the HTTP controller endpoint.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, Cpu, GraduationCap, ArrowRight, Coins, BriefcaseBusiness } from 'lucide-react';
import { useTranslation } from '../core/i18n/UiI18n';
import { checkPycoreNow } from '../core/integrations/pycore/PycoreHealth';
import { END_META } from './shellTypes';

type Health = 'checking' | 'up' | 'down' | 'unknown';

function HealthDot({ state, label }: { state: Health; label: string }) {
  const color =
    state === 'up' ? 'bg-emerald-500' :
    state === 'down' ? 'bg-rose-500' :
    state === 'checking' ? 'bg-amber-400 animate-pulse' :
    'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className={`w-2 h-2 rounded-full ${color}`} />{label}
    </span>
  );
}

const CARDS = [
  {
    id: 'laravel-manager' as const,
    icon: Server,
    title: END_META['laravel-manager'].label,
    descKey: 'common.app_laravel_description',
    accent: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'pycore-manager' as const,
    icon: Cpu,
    title: END_META['pycore-manager'].label,
    descKey: 'common.app_pycore_description',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    id: 'wordnew' as const,
    icon: GraduationCap,
    title: END_META['wordnew'].label,
    descKey: 'common.app_wordnew_description',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'vortex' as const,
    icon: Coins,
    title: END_META['vortex'].label,
    descKey: 'common.app_vortex_description',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'codemart' as const,
    icon: BriefcaseBusiness,
    title: END_META['codemart'].label,
    descKey: 'common.app_codemart_description',
    accent: 'from-blue-500 to-cyan-500',
  },
  // PDD Manager card archived; keep the PDD app source available without exposing it in the shell.
];

export const ShellHome: React.FC = () => {
  const { t } = useTranslation();
  const [pycoreHealth, setPycoreHealth] = useState<Health>('checking');

  useEffect(() => {
    let alive = true;
    void checkPycoreNow().then((up) => {
      if (alive) setPycoreHealth(up ? 'up' : 'down');
    });
    return () => { alive = false; };
  }, []);

  const healthFor = (id: string): Health => (id === 'pycore-manager' ? pycoreHealth : 'unknown');
  const healthLabel = (state: Health): string => {
    if (state === 'up') return t('common.health_online');
    if (state === 'down') return t('common.health_offline');
    if (state === 'checking') return t('common.health_checking');
    return t('common.health_unknown');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">{t('common.control_center')}</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t('common.control_center_subtitle')}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.id}
                to={END_META[c.id].path}
                className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.accent} text-white flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{c.title}</h2>
                  <HealthDot state={healthFor(c.id)} label={healthLabel(healthFor(c.id))} />
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t(c.descKey)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {t('common.enter')} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ShellHome;
