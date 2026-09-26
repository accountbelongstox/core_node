import React from 'react';
import { Loader2, MonitorCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  TerminalCapability,
  TerminalCapabilityName,
  TerminalDesktopIntegrationAction,
  TerminalSnapshot,
} from '@/apps/pycore-manager/api';

const CAPABILITY_ORDER: TerminalCapabilityName[] = [
  'x11',
  'gnome_bridge',
  'gnome_introspect',
  'portal',
];
const BRIDGE_INSTALL_STATES = new Set(['gnome_bridge_not_installed', 'gnome_bridge_outdated']);
const BRIDGE_ENABLE_STATES = new Set([
  'gnome_bridge_disabled',
  'gnome_bridge_user_extensions_disabled',
]);
const BRIDGE_DISABLE_STATES = new Set(['active', 'gnome_bridge_relogin_required']);

interface PcTerminalDesktopIntegrationProps {
  snapshot: TerminalSnapshot | null;
  busyAction: TerminalDesktopIntegrationAction | null;
  errorTranslationKey: (errorCode?: string | null) => string;
  onAction: (action: TerminalDesktopIntegrationAction) => void;
}

function capabilityDetail(capability: TerminalCapability): string | null {
  if (capability.available) return null;
  return capability.state || capability.error_code || null;
}

export default function PcTerminalDesktopIntegration({
  snapshot,
  busyAction,
  errorTranslationKey,
  onAction,
}: PcTerminalDesktopIntegrationProps) {
  const { t } = useTranslation();
  const profile = snapshot?.platform_profile;
  const capabilities = snapshot?.capabilities;
  if (!profile || profile.platform !== 'linux' || !capabilities) return null;

  const bridgeState = String(capabilities.gnome_bridge?.state || '');
  const portal = capabilities.portal;
  const actions: TerminalDesktopIntegrationAction[] = [];
  if (BRIDGE_INSTALL_STATES.has(bridgeState)) actions.push('install_bridge');
  if (BRIDGE_ENABLE_STATES.has(bridgeState)) actions.push('enable_bridge');
  if (BRIDGE_DISABLE_STATES.has(bridgeState)) actions.push('disable_bridge');
  if (portal?.available) actions.push(portal.authorized ? 'revoke_portal' : 'authorize_portal');

  const actionLabels: Record<TerminalDesktopIntegrationAction, string> = {
    status: 'common.refresh',
    install_bridge: 'terminal.desktop.installBridge',
    enable_bridge: 'terminal.desktop.enableBridge',
    disable_bridge: 'terminal.desktop.disableBridge',
    authorize_portal: 'terminal.desktop.authorizePortal',
    revoke_portal: 'terminal.desktop.revokePortal',
  };

  return (
    <section className="pc-glass space-y-2.5 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <MonitorCog className="h-4 w-4 text-indigo-500" />
          {t('terminal.desktop.title')}
        </span>
        <span className="text-slate-500">
          {t('terminal.desktop.profile')}: {profile.distro} {profile.version} · {profile.desktop} · {profile.session}
          {profile.xwayland ? ' + Xwayland' : ''}
        </span>
        {!profile.supported_profile && (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            {t('terminal.desktop.unsupportedProfile')}
          </span>
        )}
        <span className="text-slate-500">
          {t('terminal.desktop.controlModes')}:
          {(snapshot?.control_modes || []).map((mode) => (
            <span
              key={mode}
              className="ml-1.5 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-500"
            >
              {t(`terminal.desktop.control.${mode}`)}
            </span>
          ))}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {CAPABILITY_ORDER.map((name) => {
          const capability = capabilities[name];
          if (!capability) return null;
          const detail = capabilityDetail(capability);
          return (
            <div key={name} className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-500/15 px-2.5 py-1.5">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                capability.available ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {t(`terminal.desktop.capabilities.${name}`)}
                  <span className="ml-1.5 font-normal text-slate-500">
                    {t(capability.available ? 'terminal.desktop.available' : 'terminal.desktop.unavailable')}
                    {capability.authorized ? ` · ${t('terminal.desktop.authorized')}` : ''}
                  </span>
                </p>
                {detail && (
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{t(errorTranslationKey(detail))}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              disabled={Boolean(busyAction)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              {busyAction === action && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t(actionLabels[action])}
            </button>
          ))}
          {busyAction === 'authorize_portal' && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">{t('terminal.desktop.authorizeHint')}</span>
          )}
        </div>
      )}
    </section>
  );
}
