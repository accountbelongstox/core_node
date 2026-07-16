/**
 * Shell home — cross-end summary. One card per end with a live-ish health dot and
 * an entry link. pycore pings :59000/ping directly; laravel/wordflow health is
 * refined when their API libraries' probes are wired into the home cards.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, Cpu, GraduationCap, ArrowRight, Coins, ShoppingBag } from 'lucide-react';
import { rewritePycoreEndpoint } from '../core/api-libs/pycore/pycoreTarget';
import { END_META } from './shellTypes';

type Health = 'checking' | 'up' | 'down' | 'unknown';

function HealthDot({ state }: { state: Health }) {
  const color =
    state === 'up' ? 'bg-emerald-500' :
    state === 'down' ? 'bg-rose-500' :
    state === 'checking' ? 'bg-amber-400 animate-pulse' :
    'bg-slate-400';
  const label =
    state === 'up' ? 'online' :
    state === 'down' ? 'offline' :
    state === 'checking' ? 'checking…' : 'unknown';
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
    desc: 'Manage the Laravel backend: server, MCP, octane, database, vocabulary, tools.',
    accent: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'pycore-manager' as const,
    icon: Cpu,
    title: END_META['pycore-manager'].label,
    desc: 'Manage the pycore service: voice queue, video extract, code sync, AI status.',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    id: 'wordflow' as const,
    icon: GraduationCap,
    title: END_META['wordflow'].label,
    desc: 'The WordNew learning client: study, libraries, quiz, tools, AI assistant.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'vortex' as const,
    icon: Coins,
    title: END_META['vortex'].label,
    desc: 'Vortex crypto trading arena with 200+ real-time simulated asset pairs & high-frequency ledgers.',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'pdd-manager' as const,
    icon: ShoppingBag,
    title: END_META['pdd-manager'].label,
    desc: 'Admin console for the 订多多 (Pinduoduo) SaaS: members, recharge, membership expiry & payment gateways.',
    accent: 'from-rose-500 to-pink-500',
  },
];

export const ShellHome: React.FC = () => {
  const [pycoreHealth, setPycoreHealth] = useState<Health>('checking');

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const pingUrl = rewritePycoreEndpoint('/ping');
    fetch(pingUrl, { signal: ctrl.signal })
      .then((r) => { if (alive) setPycoreHealth(r.ok ? 'up' : 'down'); })
      .catch(() => { if (alive) setPycoreHealth('down'); })
      .finally(() => clearTimeout(t));
    return () => { alive = false; ctrl.abort(); clearTimeout(t); };
  }, []);

  const healthFor = (id: string): Health => (id === 'pycore-manager' ? pycoreHealth : 'unknown');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Control Center</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            One front-end managing three ends — Laravel, pycore, and WordFlow. Pick an app to enter.
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
                  <HealthDot state={healthFor(c.id)} />
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  Enter <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
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
