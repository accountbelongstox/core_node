/**
 * PcMeshLoginPage — Mesh VPN (Headscale) login guide. Everything shown is read
 * live from the Laravel beside the Headscale control server: login server,
 * MagicDNS domain and devices; a single-use pre-auth key is minted on demand;
 * a key-less login (iOS, browser flow) is approved here by its auth ID.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copyTextToSystemClipboard } from '@/core/browser/SystemClipboard';
import { meshAuthIdOf } from '@/core/contracts/MeshDomain';
import { meshGuideApi, MESH_GUIDE_API_ORIGIN, type MeshGuide, type MeshPreauthKey } from '@/apps/pycore-manager/api/MeshGuideApi';
import { requestAuthLogin } from '@/core/auth/AuthRequestCenter';
import { authEndpointLabel } from '@/core/auth/AuthSession';
import { useAuthSnapshot } from '@/core/auth/useAuthSession';
import { laravelUserLabel } from '@/core/auth/LaravelUser';
import { logoutLaravel } from '@/core/integrations/laravel/LaravelAuthClient';

type Platform = 'android' | 'ios' | 'windows' | 'linux' | 'macos';

const PLATFORMS: Platform[] = ['android', 'ios', 'windows', 'linux', 'macos'];
const COPIED_RESET_MS = 1_500;
const KEY_PLACEHOLDER = '<pre-auth key>';

const UNAUTHORIZED_STATUS = 401;
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const isUnauthorized = (error: unknown): boolean => (error as { status?: unknown } | null)?.status === UNAUTHORIZED_STATUS;
const localTime = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '');

const CopyValue: React.FC<{ value: string; mono?: boolean }> = ({ value, mono = true }) => {
  const { t } = useTranslation('pc');
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!(await copyTextToSystemClipboard(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [value]);
  return (
    <div className="flex items-start gap-2">
      <code className={`flex-1 break-all rounded-xl bg-slate-500/10 px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}>{value}</code>
      <button type="button" onClick={copy} disabled={!value}
        className="shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t('meshLogin.copied') : t('meshLogin.copy')}
      </button>
    </div>
  );
};

const PcMeshLoginPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const [guide, setGuide] = useState<MeshGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const auth = useAuthSnapshot(MESH_GUIDE_API_ORIGIN);
  const host = authEndpointLabel(MESH_GUIDE_API_ORIGIN);
  const [key, setKey] = useState<MeshPreauthKey | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [authText, setAuthText] = useState('');
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveNote, setApproveNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNeedsLogin(false);
    try {
      setGuide(await meshGuideApi.guide());
    } catch (error) {
      if (isUnauthorized(error)) {
        setGuide(null);
        setNeedsLogin(true);
      } else setLoadError(t('meshLogin.loadFailed', { error: errorText(error) }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // The guide is read on entry and again after a sign-in; a sign-out only shows the sign-in prompt.
  const wasLoggedInRef = useRef(false);
  useEffect(() => {
    if (!auth.loggedIn && wasLoggedInRef.current) {
      wasLoggedInRef.current = false;
      setGuide(null);
      setKey(null);
      setNeedsLogin(true);
      return;
    }
    wasLoggedInRef.current = auth.loggedIn;
    void load();
  }, [load, auth.loggedIn]);

  const generateKey = useCallback(async () => {
    setKeyBusy(true);
    setKeyError('');
    try {
      setKey(await meshGuideApi.createPreauthKey());
    } catch (error) {
      setKeyError(t('meshLogin.key.failed', { error: errorText(error) }));
    } finally {
      setKeyBusy(false);
    }
  }, [t]);

  const approve = useCallback(async () => {
    const authId = meshAuthIdOf(authText);
    if (!authId) {
      setApproveNote(t('meshLogin.approve.invalid'));
      return;
    }
    setApproveBusy(true);
    try {
      setApproveNote(t('meshLogin.approve.done', { message: await meshGuideApi.register(authId) }));
      setAuthText('');
      void load();
    } catch (error) {
      setApproveNote(t('meshLogin.approve.failed', { error: errorText(error) }));
    } finally {
      setApproveBusy(false);
    }
  }, [authText, load, t]);

  const server = guide?.login_server ?? '';
  const keyValue = key?.key ?? KEY_PLACEHOLDER;
  const desktopCommand = platform === 'linux'
    ? `sudo tailscale up --login-server=${server} --authkey=${keyValue} --accept-routes`
    : `tailscale login --login-server=${server} --authkey=${keyValue}`;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('meshLogin.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('meshLogin.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t('meshLogin.refresh')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {auth.loggedIn ? (
          <>
            <span>{t('meshLogin.auth.signedIn', { host, user: laravelUserLabel(auth.user) })}</span>
            <button type="button" onClick={() => void logoutLaravel(MESH_GUIDE_API_ORIGIN)}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 pc-glass">
              <LogOut size={12} />{t('meshLogin.auth.logout')}
            </button>
          </>
        ) : null}
      </div>
      {needsLogin && (
        <section className="pc-glass p-4 space-y-3">
          <p className="text-sm">{t('meshLogin.auth.required', { host })}</p>
          <button type="button"
            onClick={() => requestAuthLogin({ source: 'pycore-mesh', reason: 'mesh-guide', baseUrl: MESH_GUIDE_API_ORIGIN })}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs bg-indigo-600 text-white">
            <LogIn size={14} />{t('meshLogin.auth.login')}
          </button>
        </section>
      )}
      {loading && !guide && <p className="text-sm text-slate-500">{t('meshLogin.loading')}</p>}
      {loadError && <p className="text-sm text-rose-500">{loadError}</p>}

      {guide && (
        <>
          <section className="pc-glass p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t('meshLogin.server.title')}</h2>
            <div className="space-y-1">
              <p className="text-[11px] text-slate-500">{t('meshLogin.server.loginServer')}</p>
              <CopyValue value={server} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500">{t('meshLogin.server.meshDomain')}</p>
                <CopyValue value={guide.mesh_domain} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500">{t('meshLogin.server.user')}</p>
                <CopyValue value={guide.user} />
              </div>
            </div>
          </section>

          <section className="pc-glass p-4 space-y-3">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1"><KeyRound size={14} />{t('meshLogin.key.title')}</h2>
            <p className="text-xs text-slate-500">{t('meshLogin.key.hint', { expiration: guide.key_expiration })}</p>
            {key && (
              <>
                <CopyValue value={key.key} />
                {key.expiration && <p className="text-[11px] text-slate-500">{t('meshLogin.key.expires', { time: localTime(key.expiration) })}</p>}
                <p className="text-[11px] text-amber-600">{t('meshLogin.key.secret')}</p>
              </>
            )}
            {keyError && <p className="text-xs text-rose-500">{keyError}</p>}
            <button type="button" onClick={() => void generateKey()} disabled={keyBusy}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
              {keyBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {key ? t('meshLogin.key.regenerate') : t('meshLogin.key.generate')}
            </button>
          </section>

          <section className="pc-glass p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t('meshLogin.platforms.title')}</h2>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((item) => (
                <button key={item} type="button" onClick={() => setPlatform(item)}
                  className={`rounded-xl px-3 py-1.5 text-xs ${platform === item ? 'bg-sky-500 text-white' : 'pc-glass'}`}>
                  {t(`meshLogin.platforms.${item}`)}
                </button>
              ))}
            </div>
            {platform === 'android' && (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>{t('meshLogin.steps.android1', { link: guide.mobile_clients.android })}</li>
                <li>{t('meshLogin.steps.android2')}<div className="mt-1"><CopyValue value={server} /></div></li>
                <li>{t('meshLogin.steps.android3')}{key && <div className="mt-1"><CopyValue value={key.key} /></div>}</li>
                <li>{t('meshLogin.steps.android4')}</li>
              </ol>
            )}
            {platform === 'ios' && (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>{t('meshLogin.steps.ios1', { link: guide.mobile_clients.ios })}</li>
                <li>{t('meshLogin.steps.ios2')}<div className="mt-1"><CopyValue value={server} /></div></li>
                <li>{t('meshLogin.steps.ios3')}</li>
                <li>{t('meshLogin.steps.ios4')}</li>
              </ol>
            )}
            {(platform === 'windows' || platform === 'linux' || platform === 'macos') && (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>{t('meshLogin.steps.desktop1')}<div className="mt-1"><CopyValue value={desktopCommand} /></div></li>
                <li>{t('meshLogin.steps.desktop2')}</li>
              </ol>
            )}
          </section>

          <section className="pc-glass p-4 space-y-3">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1"><ShieldCheck size={14} />{t('meshLogin.approve.title')}</h2>
            <p className="text-xs text-slate-500">{t('meshLogin.approve.hint')}</p>
            <div className="flex flex-wrap gap-2">
              <input value={authText} onChange={(event) => setAuthText(event.target.value)}
                placeholder={t('meshLogin.approve.placeholder')}
                className="flex-1 min-w-[14rem] px-3 py-2 rounded-xl text-sm pc-glass border-0 bg-slate-500/5 font-mono" />
              <button type="button" onClick={() => void approve()} disabled={approveBusy || !authText.trim()}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs pc-glass disabled:opacity-40">
                {approveBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {t('meshLogin.approve.button')}
              </button>
            </div>
            {approveNote && <p className="text-xs text-slate-600 dark:text-slate-300">{approveNote}</p>}
          </section>

          <section className="pc-glass p-4 space-y-2">
            <h2 className="text-sm font-semibold">{t('meshLogin.nodes.title', { count: guide.nodes.length })}</h2>
            {guide.nodes.length === 0 && <p className="text-xs text-slate-500">{t('meshLogin.nodes.none')}</p>}
            <ul className="divide-y divide-slate-500/10">
              {guide.nodes.map((node) => (
                <li key={node.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-mono">{node.name}.{guide.mesh_domain}</span>
                  <span className="font-mono text-xs text-slate-500">{node.ip_addresses.join(' · ')}</span>
                  <span className={`text-xs ${node.online ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {node.online ? t('meshLogin.nodes.online') : t('meshLogin.nodes.offline')}
                    {!node.online && node.last_seen ? ` · ${t('meshLogin.nodes.lastSeen', { time: localTime(node.last_seen) })}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default PcMeshLoginPage;
