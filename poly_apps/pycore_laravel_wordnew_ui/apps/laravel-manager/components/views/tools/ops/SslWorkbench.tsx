/** SSL Certificate Manager: expiry timeline with days-left colour and a per-certificate renew with live output. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import type { StatusTone } from '@/shared/ui/statusTone';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Console, EmptyBlock, Metric, Notice, OpsPage, OpsStatusBar, Panel } from './opsKit';
import { describeError, useMountedRef, useRemote } from './opsHooks';
import { certTone, pollUntil } from './opsLogic';
import type { CertEnsureData, CertificateRow, CertificatesData, CertProgressData } from './opsTypes';

interface Renewal {
  domain: string;
  lines: string[];
  running: boolean;
  error: string | null;
}

const WINDOW_DAYS = 90;
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 100;
const TONE: Record<'ok' | 'warn' | 'crit', StatusTone> = { ok: 'emerald', warn: 'amber', crit: 'rose' };

const SslWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  const certificates = useRemote(() => callToolApi<CertificatesData>(tool.apiMethod), []);
  const rows = useMemo(() => [...(certificates.data?.certificates ?? [])].sort((a, b) => a.days_until_expiry - b.days_until_expiry), [certificates.data]);
  const critical = rows.filter((row) => certTone(row.days_until_expiry) === 'crit').length;
  const warning = rows.filter((row) => certTone(row.days_until_expiry) === 'warn').length;
  const nextExpiry = rows[0];

  const renew = async (row: CertificateRow): Promise<void> => {
    if (renewal?.running || !window.confirm(t('toolsOps.ssl.confirm_renew', { domain: row.domain }))) return;
    setRenewal({ domain: row.domain, lines: [], running: true, error: null });
    try {
      const started = await callToolApi<CertEnsureData>('serverManagerV1.ensureCertificate', { domain: row.domain });
      if (started.request_id) {
        const requestId = started.request_id;
        await pollUntil(
          () => callToolApi<CertProgressData>('serverManagerV1.certificateProgress', requestId),
          (progress) => progress.status === 'completed',
          {
            intervalMs: POLL_INTERVAL_MS,
            maxAttempts: POLL_ATTEMPTS,
            isCancelled: () => !mounted.current,
            onTick: (progress) => { if (mounted.current) setRenewal({ domain: row.domain, lines: progress.output_lines ?? [], running: progress.status !== 'completed', error: null }); },
          },
        );
      } else if (mounted.current) {
        setRenewal({ domain: row.domain, lines: started.output_lines ?? [], running: false, error: null });
      }
      if (mounted.current) await certificates.reload(true);
    } catch (err) {
      if (mounted.current) setRenewal({ domain: row.domain, lines: [], running: false, error: describeError(t, err) });
    }
  };

  return (
    <OpsPage>
      <OpsStatusBar accent="teal" mode="server" updatedAt={certificates.updatedAt} loading={certificates.loading} onRefresh={() => void certificates.reload()}>
        {certificates.data
          ? t('toolsOps.ssl.status', { total: rows.length, manager: certificates.data.manager ?? 'certbot' })
          : t('toolsOps.common.loading')}
      </OpsStatusBar>
      {certificates.error && <Notice tone="error">{certificates.error}</Notice>}
      {certificates.data?.error && <Notice tone="warn">{certificates.data.error}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={t('toolsOps.ssl.total')} value={rows.length} icon={Lock} />
        <Metric label={t('toolsOps.ssl.critical')} value={critical} valueClassName={critical ? 'text-rose-600 dark:text-rose-400' : undefined} icon={ShieldAlert} />
        <Metric label={t('toolsOps.ssl.warning')} value={warning} valueClassName={warning ? 'text-amber-600 dark:text-amber-400' : undefined} />
        <Metric label={t('toolsOps.ssl.next_expiry')} value={nextExpiry ? t('toolsOps.ssl.days', { count: nextExpiry.days_until_expiry }) : '-'} hint={nextExpiry?.domain} />
      </div>

      <Panel title={t('toolsOps.ssl.timeline')} icon={Lock} accent="teal" bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyBlock icon={Lock}>{certificates.loading ? t('toolsOps.common.loading') : t('toolsOps.ssl.empty')}</EmptyBlock>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rows.map((row) => {
              const tone = certTone(row.days_until_expiry);
              const sans = row.domains.filter((name) => name !== row.domain);
              return (
                <li key={row.name} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 basis-48 truncate text-sm font-semibold text-slate-900 dark:text-white">{row.domain}</p>
                    <Pill tone={TONE[tone]} tint>{row.days_until_expiry <= 0 ? t('toolsOps.ssl.expired') : t('toolsOps.ssl.days', { count: row.days_until_expiry })}</Pill>
                    <Btn size="sm" icon={RefreshCw} loading={renewal?.running && renewal.domain === row.domain} onClick={() => void renew(row)} disabled={Boolean(renewal?.running)}>{t('toolsOps.ssl.renew')}</Btn>
                  </div>
                  <ProgressBar done={Math.max(0, row.days_until_expiry)} total={WINDOW_DAYS} tone={TONE[tone]} className="h-2" label={row.domain} />
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    {row.expiry_date && <span>{t('toolsOps.ssl.expires', { date: row.expiry_date.replace(/\s*\(.*$/, '') })}</span>}
                    {row.issuer && <span className="truncate">{row.issuer}</span>}
                    {sans.length > 0 && <span className="truncate">+{sans.length}: {sans.slice(0, 3).join(', ')}{sans.length > 3 ? '…' : ''}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {renewal && (
        <Panel title={t('toolsOps.ssl.renewal_output', { domain: renewal.domain })} icon={RefreshCw} accent="teal" actions={<Pill tone={renewal.error ? 'rose' : renewal.running ? 'amber' : 'emerald'} tint>{renewal.error ? t('toolsOps.nginx.failed') : renewal.running ? t('toolsOps.ssl.running') : t('toolsOps.nginx.ok')}</Pill>}>
          {renewal.error && <Notice tone="error" className="mb-3">{renewal.error}</Notice>}
          <Console>{renewal.lines.join('\n') || t('toolsOps.nginx.no_output')}</Console>
        </Panel>
      )}
    </OpsPage>
  );
};

export default SslWorkbench;
