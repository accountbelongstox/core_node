// 订多多 toolbar popup.
// Compact (~360px) control surface: license status, backend/super-code unlock,
// bound Pinduoduo accounts, and quick actions. All extension state flows through
// '@/lib/dashboardBridge'; only the footer touches chrome.* to open the dashboard.

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Package,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronUp,
  ServerCog,
  Plus,
  X,
  RefreshCw,
  ExternalLink,
  Loader2,
  Check,
  UserRound,
  ShieldCheck,
  Crown,
} from 'lucide-react';
import {
  getLicense,
  submitSuperCode,
  loginMember,
  clearLicense,
  listAccounts,
  captureActiveTab,
  bindAccount,
  removeAccount,
  setActiveAccount,
  syncOrders,
} from '@/lib/dashboardBridge';
import { isLicenseActive } from '@/lib/superCode';
import type { LicenseState, PinduoduoAccount } from '@/lib/types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:9000';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? '');
}

type ChipKind = 'super' | 'member' | 'locked';

function licenseChip(license: LicenseState | null): { kind: ChipKind; label: string } {
  if (!isLicenseActive(license)) return { kind: 'locked', label: '未授权' };
  if (license?.mode === 'super') return { kind: 'super', label: '超级码' };
  return { kind: 'member', label: '会员' };
}

const CHIP_CLASS: Record<ChipKind, string> = {
  super: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  member: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  locked: 'bg-slate-600/25 text-slate-300 border-slate-600/40',
};

export function Popup() {
  // License / backend state
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [superCode, setSuperCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showBackend, setShowBackend] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // Account state
  const [accounts, setAccounts] = useState<PinduoduoAccount[]>([]);
  const [activePddUserId, setActivePddUserId] = useState<string | undefined>(undefined);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshAccounts = useCallback(async () => {
    try {
      const payload = await listAccounts();
      setAccounts(payload.accounts);
      setActivePddUserId(payload.activePddUserId);
    } catch (e) {
      setAccountError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [lic] = await Promise.all([getLicense().catch(() => null), refreshAccounts()]);
        if (alive) setLicense(lic);
      } finally {
        if (alive) setBootLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [refreshAccounts]);

  const active = isLicenseActive(license);
  const chip = licenseChip(license);

  // --- License actions ---
  async function handleActivate() {
    const code = superCode.trim();
    if (!code) {
      setLicenseError('请输入超级码');
      return;
    }
    setActivating(true);
    setLicenseError(null);
    try {
      const lic = await submitSuperCode(code);
      setLicense(lic);
      setSuperCode('');
      showToast('授权成功');
    } catch (e) {
      setLicenseError(errMsg(e) || '超级码无效');
    } finally {
      setActivating(false);
    }
  }

  async function handleLogin() {
    if (!baseUrl.trim() || !username.trim() || !password) {
      setLicenseError('请填写后台地址、用户名与密码');
      return;
    }
    setLoggingIn(true);
    setLicenseError(null);
    try {
      const lic = await loginMember(baseUrl.trim(), username.trim(), password);
      setLicense(lic);
      setPassword('');
      showToast('会员登录成功');
    } catch (e) {
      setLicenseError(errMsg(e) || '登录失败');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setLicenseError(null);
    try {
      await clearLicense();
      setLicense(null);
      showToast('已退出授权');
    } catch (e) {
      setLicenseError(errMsg(e));
    } finally {
      setClearing(false);
    }
  }

  // --- Account actions ---
  async function handleCapture() {
    setCapturing(true);
    setAccountError(null);
    try {
      const cap = await captureActiveTab();
      const payload = await bindAccount(cap.pddUserId, cap.accessToken, cap.nickname, cap.avatar);
      setAccounts(payload.accounts);
      setActivePddUserId(payload.activePddUserId);
      showToast(`已绑定 ${cap.nickname || cap.pddUserId}`);
    } catch (e) {
      setAccountError(errMsg(e) || '请先在已登录的拼多多页面打开此插件');
    } finally {
      setCapturing(false);
    }
  }

  async function handleSetActive(pddUserId: string) {
    if (pddUserId === activePddUserId || busyAccountId) return;
    setBusyAccountId(pddUserId);
    setAccountError(null);
    try {
      const payload = await setActiveAccount(pddUserId);
      setAccounts(payload.accounts);
      setActivePddUserId(payload.activePddUserId);
    } catch (e) {
      setAccountError(errMsg(e));
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleRemove(e: MouseEvent, pddUserId: string) {
    e.stopPropagation();
    if (busyAccountId) return;
    setBusyAccountId(pddUserId);
    setAccountError(null);
    try {
      const payload = await removeAccount(pddUserId);
      setAccounts(payload.accounts);
      setActivePddUserId(payload.activePddUserId);
      showToast('已移除账号');
    } catch (err) {
      setAccountError(errMsg(err));
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleSync() {
    if (!activePddUserId) {
      setAccountError('请先捕获并选择一个拼多多账号');
      return;
    }
    setSyncing(true);
    setAccountError(null);
    try {
      const result = await syncOrders();
      showToast(`已同步 ${result.fetched} 条订单`);
    } catch (e) {
      setAccountError(errMsg(e) || '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  // --- Footer: open dashboard tab ---
  function openDashboard() {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      window.close();
    }
  }

  return (
    <div className="relative flex w-[360px] flex-col gap-3 p-3 text-sm">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
            <Package className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-50">订多多</span>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${CHIP_CLASS[chip.kind]}`}
        >
          {chip.kind === 'super' ? (
            <Crown className="h-3 w-3" />
          ) : chip.kind === 'member' ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <KeyRound className="h-3 w-3" />
          )}
          {chip.label}
        </span>
      </header>

      {bootLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载中…</span>
        </div>
      ) : (
        <>
          {/* License section */}
          {active ? (
            <section className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">
                    {license?.label || (license?.mode === 'super' ? '超级码授权' : '会员授权')}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    版本：{license?.tier || 'free'}
                    {license?.offline ? ' · 离线' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-600/60 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700/60 disabled:opacity-50"
                >
                  {clearing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <LogOut className="h-3 w-3" />
                  )}
                  退出授权
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3">
              {/* Super-code */}
              <label className="mb-1 block text-xs font-medium text-slate-300">超级码</label>
              <div className="flex gap-2">
                <input
                  value={superCode}
                  onChange={(e) => setSuperCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  placeholder="DDK-XXXX-XXXXXX"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-slate-600/60 bg-slate-900/70 px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500/70"
                />
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  激活
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                无后台时输入超级码即可离线使用全部功能。
              </p>

              {/* Collapsible backend login */}
              <button
                type="button"
                onClick={() => setShowBackend((v) => !v)}
                className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs text-slate-300 transition hover:text-slate-100"
              >
                <span className="flex items-center gap-1.5">
                  <ServerCog className="h-3.5 w-3.5" />
                  连接后台登录
                </span>
                {showBackend ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {showBackend && (
                <div className="mt-2 space-y-2">
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="后台地址"
                    spellCheck={false}
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500/70"
                  />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="用户名"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500/70"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="密码"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500/70"
                  />
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loggingIn}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-700/50 px-3 py-1.5 font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {loggingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    登录
                  </button>
                </div>
              )}

              {licenseError && (
                <p className="mt-2 text-[11px] text-red-400">{licenseError}</p>
              )}
            </section>
          )}
          {active && licenseError && (
            <p className="-mt-1 px-1 text-[11px] text-red-400">{licenseError}</p>
          )}

          {/* Accounts section */}
          <section className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">拼多多账号</span>
              <span className="text-[11px] text-slate-500">{accounts.length} 个</span>
            </div>

            {accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700/70 px-2 py-3 text-center text-[11px] text-slate-500">
                暂无绑定账号
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {accounts.map((acc) => {
                  const isActive = acc.pddUserId === activePddUserId;
                  const busy = busyAccountId === acc.pddUserId;
                  return (
                    <li key={acc.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSetActive(acc.pddUserId)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetActive(acc.pddUserId)}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                          isActive
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600'
                        } ${busy ? 'opacity-60' : 'cursor-pointer'}`}
                      >
                        {acc.avatar ? (
                          <img
                            src={acc.avatar}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                            <UserRound className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-100">{acc.name || acc.pddUserId}</p>
                          <p
                            className={`text-[10px] ${
                              acc.status === 'EXPIRED' ? 'text-amber-400' : 'text-slate-500'
                            }`}
                          >
                            {acc.status === 'EXPIRED' ? '登录已过期' : '正常'}
                          </p>
                        </div>
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                        ) : isActive ? (
                          <Check className="h-4 w-4 shrink-0 text-red-400" />
                        ) : null}
                        <button
                          type="button"
                          title="移除账号"
                          onClick={(e) => handleRemove(e, acc.pddUserId)}
                          disabled={busy}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-700 hover:text-red-400 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={handleCapture}
              disabled={capturing}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-600/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              捕获当前拼多多账号
            </button>

            {accountError && (
              <p className="mt-2 text-[11px] text-red-400">{accountError}</p>
            )}
          </section>

          {/* Footer actions */}
          <footer className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/60 bg-slate-700/50 px-3 py-2 font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              同步当前账号订单
            </button>
            <button
              type="button"
              onClick={openDashboard}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white transition hover:bg-red-500"
            >
              <ExternalLink className="h-4 w-4" />
              打开订单管理终端
            </button>
          </footer>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-full bg-slate-950/90 px-3 py-1 text-xs text-slate-100 shadow-lg ring-1 ring-slate-700">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
