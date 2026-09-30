/**
 * PcToolChrome — the shared frame of every Tools page (translate, image search,
 * subtitle search, word audio): page heading with refresh, the offline banner and
 * the status card (badges + labelled fields + hint). Pages only supply content.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, WifiOff } from 'lucide-react';

type PcIcon = React.FC<{ className?: string }>;

export const PcOfflineBanner: React.FC = () => {
  const { t } = useTranslation('pc');
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
      <WifiOff className="w-4 h-4" /> {t('aiHub.tools.offline')}
    </div>
  );
};

export interface PcToolStatusField {
  label: React.ReactNode;
  value: React.ReactNode;
  Icon?: PcIcon;
  mono?: boolean;
}

export interface PcToolStatusCardProps {
  title: string;
  subtitle: string;
  Icon: PcIcon;
  accent: string;
  loading: boolean;
  offline: boolean;
  onRefresh: () => void;
  statusLabel: string;
  badges: React.ReactNode;
  fields: PcToolStatusField[];
  hint?: string | null;
  footer?: React.ReactNode;
  columnsClass?: string;
}

export const PcToolStatusCard: React.FC<PcToolStatusCardProps> = ({
  title, subtitle, Icon, accent, loading, offline, onRefresh, statusLabel, badges, fields, hint, footer,
  columnsClass = 'grid-cols-2 md:grid-cols-4',
}) => {
  const { t } = useTranslation('pc');
  return (
    <section className="pc-glass p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Icon className={`w-5 h-5 ${accent}`} /> {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </button>
      </div>

      {offline && <PcOfflineBanner />}

      <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{statusLabel}</span>
          <div className="flex items-center gap-2">{badges}</div>
        </div>
        <div className={`grid ${columnsClass} gap-3 text-[11px]`}>
          {fields.map((field, index) => (
            <div key={index} className="min-w-0">
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                {field.Icon && <field.Icon className="w-3 h-3" />} {field.label}
              </div>
              <div className={`${field.mono === false ? '' : 'font-mono '}text-slate-600 dark:text-slate-300 truncate`}>{field.value}</div>
            </div>
          ))}
        </div>
        {hint && <div className="mt-3 text-[10px] text-amber-500">{hint}</div>}
        {footer}
      </div>
    </section>
  );
};
