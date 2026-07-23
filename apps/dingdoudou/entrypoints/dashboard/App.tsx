import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckSquare,
  Download,
  Filter,
  Key,
  Languages,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import type { AccountStats, InvoiceStatus, LicenseState, Order, PinduoduoAccount } from '@/lib/types';
import {
  bindAccount,
  captureActiveTab,
  clearLicense,
  getAllOrders,
  getCachedOrders,
  getLicense,
  getSettings,
  inExtension,
  listAccounts,
  loginMember,
  patchSettings,
  refundOrders,
  removeAccount,
  setActiveAccount,
  submitSuperCode,
  syncOrders,
} from '@/lib/dashboardBridge';
import { downloadCsv } from '@/lib/exportCsv';
import { hasFeature } from '@/lib/superCode';
import { dashboardText, localeFor, nextLanguage, orderCardText } from '@/lib/uiI18n';
import { AccountPanel } from './components/AccountPanel';
import { LogisticsModal } from './components/LogisticsModal';
import { OrderCard } from './components/OrderCard';
import { ReconciliationModal } from './components/ReconciliationModal';
import { BASE_PDD_ACCOUNTS, generateMockOrders, INITIAL_STATS } from './data';
import { i18n, type Language } from './i18n';

const LOCAL_ORDERS_KEY = 'dingduoduo_orders_v2';
const LOCAL_ACCOUNTS_KEY = 'dingduoduo_accounts_v2';
const LOCAL_STATS_KEY = 'dingduoduo_stats_v2';
const LOCAL_LANG_KEY = 'dingduoduo_lang_v2';
const LOCAL_THEME_KEY = 'dingduoduo_theme_v2';
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:9000';
const ALL_RECIPIENTS = '__all__';

type Theme = 'light' | 'dark';
type AccountScope = 'active' | 'all';
type StatusFilter = 'all' | Order['status'];
type Toast = { text: string; type: 'success' | 'info' | 'error' };

function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, days - 1));
  return formatDate(date);
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function orderBelongsTo(order: Order, account: PinduoduoAccount | null): boolean {
  if (!account) return false;
  return order.pddUserId
    ? order.pddUserId === account.pddUserId
    : order.accountName === account.name;
}

function orderKey(order: Order): string {
  return `${order.pddUserId ?? order.accountName}:${order.id}`;
}

function orderTimestamp(value: string): number | null {
  const timestamp = new Date(value.replace(/\//g, '-')).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export default function App() {
  const extensionMode = inExtension();
  const toastTimer = useRef<number | null>(null);
  const [lang, setLang] = useState<Language>(() => readLocal(LOCAL_LANG_KEY, 'zh'));
  const [theme, setTheme] = useState<Theme>(() => readLocal(LOCAL_THEME_KEY, 'dark'));
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [licenseChecked, setLicenseChecked] = useState(!extensionMode);
  const [settingsReady, setSettingsReady] = useState(!extensionMode);
  const [gateTab, setGateTab] = useState<'super' | 'backend'>('super');
  const [superCode, setSuperCode] = useState('');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [backendUser, setBackendUser] = useState('');
  const [backendPassword, setBackendPassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [accounts, setAccounts] = useState<PinduoduoAccount[]>([]);
  const [activeAccount, setActiveAccountState] = useState<PinduoduoAccount | null>(null);
  const [accountScope, setAccountScope] = useState<AccountScope>('active');
  const [stats, setStats] = useState<AccountStats>(INITIAL_STATS);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [recipient, setRecipient] = useState(ALL_RECIPIENTS);
  const [startDate, setStartDate] = useState(() => daysAgo(30));
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [selectedDetails, setSelectedDetails] = useState<Order | null>(null);
  const [showReconcile, setShowReconcile] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const t = i18n[lang];
  const ui = dashboardText(lang);
  const cardUi = orderCardText(lang);

  const notify = useCallback((text: string, type: Toast['type'] = 'success') => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const savePreviewOrders = useCallback((next: Order[]) => {
    setOrders(next);
    if (!extensionMode) localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
  }, [extensionMode]);

  const loadOrders = useCallback(async (scope: AccountScope, account: PinduoduoAccount | null) => {
    if (!extensionMode) return;
    setOrders(scope === 'all' ? await getAllOrders() : await getCachedOrders(account?.pddUserId));
  }, [extensionMode]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(LOCAL_THEME_KEY, JSON.stringify(theme));
    if (extensionMode && settingsReady) void patchSettings({ theme });
  }, [extensionMode, settingsReady, theme]);

  useEffect(() => {
    localStorage.setItem(LOCAL_LANG_KEY, JSON.stringify(lang));
    if (extensionMode && settingsReady) void patchSettings({ lang });
  }, [extensionMode, lang, settingsReady]);

  useEffect(() => {
    if (!extensionMode) return;
    void Promise.all([getLicense().catch(() => null), getSettings().catch(() => null)])
      .then(([storedLicense, settings]) => {
        setLicense(storedLicense);
        if (settings) {
          setLang(settings.lang);
          setTheme(settings.theme);
        }
      })
      .finally(() => {
        setSettingsReady(true);
        setLicenseChecked(true);
      });
  }, [extensionMode]);

  useEffect(() => {
    if (extensionMode) return;
    const previewOrders = readLocal<Order[]>(LOCAL_ORDERS_KEY, generateMockOrders());
    const previewAccounts = readLocal<PinduoduoAccount[]>(LOCAL_ACCOUNTS_KEY, BASE_PDD_ACCOUNTS);
    setOrders(previewOrders);
    setAccounts(previewAccounts);
    setActiveAccountState(previewAccounts[0] ?? null);
    setStats(readLocal<AccountStats>(LOCAL_STATS_KEY, INITIAL_STATS));
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(previewOrders));
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(previewAccounts));
  }, [extensionMode]);

  useEffect(() => {
    if (!extensionMode || !license || license.mode === 'locked') return;
    void listAccounts()
      .then(async (payload) => {
        const active = payload.accounts.find((item) => item.pddUserId === payload.activePddUserId)
          ?? payload.accounts[0]
          ?? null;
        setAccounts(payload.accounts);
        setActiveAccountState(active);
        await loadOrders(accountScope, active);
      })
      .catch((error) => notify(error instanceof Error ? error.message : String(error), 'error'));
  }, [accountScope, extensionMode, license, loadOrders, notify]);

  const recipients = useMemo(() => {
    return [...new Set(orders.map((order) => order.recipientName.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, localeFor(lang)));
  }, [lang, orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59.999`).getTime();
    return orders.filter((order) => {
      if (accountScope === 'active' && !orderBelongsTo(order, activeAccount)) return false;
      if (status !== 'all' && order.status !== status) return false;
      if (recipient !== ALL_RECIPIENTS && order.recipientName !== recipient) return false;
      const timestamp = orderTimestamp(order.orderTime);
      if (timestamp === null || timestamp < start || timestamp > end) return false;
      if (!query) return true;
      return [
        order.id,
        order.expressNumber,
        order.productName,
        order.storeName,
        order.recipientName,
        order.recipientPhone,
        order.recipientAddress,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [accountScope, activeAccount, endDate, orders, recipient, search, startDate, status]);

  const selectedOrders = useMemo(() => filteredOrders.filter((order) => order.selected), [filteredOrders]);

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setRecipient(ALL_RECIPIENTS);
    setStartDate(daysAgo(30));
    setEndDate(formatDate(new Date()));
  };

  const setPreset = (days: number) => {
    setStartDate(daysAgo(days));
    setEndDate(formatDate(new Date()));
  };

  const handleSuperCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setGateBusy(true);
    setGateError('');
    try {
      setLicense(await submitSuperCode(superCode.trim()));
    } catch (error) {
      setGateError(error instanceof Error ? error.message : String(error));
    } finally {
      setGateBusy(false);
    }
  };

  const handleMemberLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setGateBusy(true);
    setGateError('');
    try {
      setLicense(await loginMember(backendUrl.trim(), backendUser.trim(), backendPassword));
    } catch (error) {
      setGateError(error instanceof Error ? error.message : String(error));
    } finally {
      setGateBusy(false);
    }
  };

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const captured = await captureActiveTab();
      const payload = await bindAccount(
        captured.pddUserId,
        captured.accessToken,
        captured.nickname,
        captured.avatar,
      );
      const active = payload.accounts.find((item) => item.pddUserId === captured.pddUserId) ?? null;
      setAccounts(payload.accounts);
      setActiveAccountState(active);
      setAccountScope('active');
      await loadOrders('active', active);
      notify(ui.accountBound(active?.name ?? captured.pddUserId));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setCapturing(false);
    }
  };

  const handleSelectAccount = async (account: PinduoduoAccount) => {
    setActiveAccountState(account);
    setAccountScope('active');
    if (!extensionMode) return;
    try {
      await setActiveAccount(account.pddUserId);
      await loadOrders('active', account);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const handleScope = async (scope: AccountScope) => {
    setAccountScope(scope);
    try {
      await loadOrders(scope, activeAccount);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const handleSync = async () => {
    const targets = accountScope === 'all' ? accounts : activeAccount ? [activeAccount] : [];
    if (!targets.length) {
      notify(ui.bindFirst, 'error');
      return;
    }
    setSyncing(true);
    try {
      let count = 0;
      for (const account of targets) {
        const result = await syncOrders(account.pddUserId);
        count += result.fetched;
      }
      await loadOrders(accountScope, activeAccount);
      notify(ui.synced(count));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toggleOrder = (target: Order, selected: boolean) => {
    const key = orderKey(target);
    savePreviewOrders(orders.map((order) => orderKey(order) === key ? { ...order, selected } : order));
  };

  const toggleAll = (selected: boolean) => {
    const keys = new Set(filteredOrders.map(orderKey));
    savePreviewOrders(orders.map((order) => keys.has(orderKey(order)) ? { ...order, selected } : order));
  };

  const handleRefund = async () => {
    if (!selectedOrders.length) {
      notify(ui.selectFirst, 'error');
      return;
    }
    setRefunding(true);
    try {
      const refunded = new Set<string>();
      if (extensionMode) {
        const groups = new Map<string, string[]>();
        for (const order of selectedOrders) {
          if (!order.pddUserId) throw new Error(ui.missingOrderOwner(order.id));
          groups.set(order.pddUserId, [...(groups.get(order.pddUserId) ?? []), order.id]);
        }
        for (const [pddUserId, ids] of groups) {
          for (const id of await refundOrders(pddUserId, ids)) refunded.add(`${pddUserId}:${id}`);
        }
      } else {
        selectedOrders.forEach((order) => refunded.add(orderKey(order)));
      }
      savePreviewOrders(orders.map((order) => refunded.has(orderKey(order))
        ? { ...order, selected: false, status: '已退款' }
        : order));
      notify(ui.refunded(refunded.size));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setRefunding(false);
    }
  };

  const handlePreviewOnlyUpdate = (id: string, kind: 'logistics' | 'invoice') => {
    if (extensionMode) {
      notify(
        ui.pddPageRequired,
        'info',
      );
      return;
    }
    savePreviewOrders(orders.map((order) => {
      if (order.id !== id) return order;
      if (kind === 'invoice') {
        const invoiceStatus: InvoiceStatus = order.invoiceStatus === '未申请' ? '已申请' : '已下载';
        return { ...order, invoiceStatus };
      }
      return { ...order, status: '待收货', latestTrack: 'Preview logistics refreshed' };
    }));
  };

  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find((account) => account.id === id);
    if (!target) return;
    try {
      if (extensionMode) {
        const payload = await removeAccount(target.pddUserId);
        const active = payload.accounts.find((item) => item.pddUserId === payload.activePddUserId)
          ?? payload.accounts[0]
          ?? null;
        setAccounts(payload.accounts);
        setActiveAccountState(active);
        await loadOrders(accountScope, active);
      } else {
        const remaining = accounts.filter((account) => account.id !== id);
        setAccounts(remaining);
        setActiveAccountState(remaining[0] ?? null);
        localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(remaining));
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(ui.copied(label));
    } catch {
      notify(ui.clipboardFailed, 'error');
    }
  };

  if (extensionMode && !licenseChecked) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  if (extensionMode && (!license || license.mode === 'locked')) {
    return (
      <div className="min-h-screen grid place-items-center p-4 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/60 dark:bg-slate-900/70 p-6 shadow-2xl backdrop-blur-2xl">
          <div className="mb-5 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-blue-500" />
            <div className="flex-1"><h1 className="font-black">{t.title}</h1><p className="text-xs text-slate-500">{ui.licenseVerification}</p></div>
            <button type="button" onClick={() => setLang(nextLanguage(lang))} className="rounded-lg border p-2 text-xs font-bold"><Languages className="h-4 w-4" /></button>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button onClick={() => setGateTab('super')} className="rounded-lg border p-2 text-xs font-bold"><Key className="mr-1 inline h-4 w-4" />{ui.superCode}</button>
            <button onClick={() => setGateTab('backend')} className="rounded-lg border p-2 text-xs font-bold"><Server className="mr-1 inline h-4 w-4" />{ui.memberBackend}</button>
          </div>
          {gateTab === 'super' ? (
            <form onSubmit={handleSuperCode} className="space-y-3">
              <input value={superCode} onChange={(event) => setSuperCode(event.target.value)} required placeholder="DDK-XXXX-XXXXXX" className="w-full rounded-lg border bg-transparent p-3 font-mono text-sm" />
              <button disabled={gateBusy} className="w-full rounded-lg bg-blue-600 p-2.5 text-sm font-bold text-white">{gateBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : ui.offlineActivate}</button>
            </form>
          ) : (
            <form onSubmit={handleMemberLogin} className="space-y-3">
              <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} required className="w-full rounded-lg border bg-transparent p-2 text-sm" />
              <input value={backendUser} onChange={(event) => setBackendUser(event.target.value)} required placeholder={ui.account} className="w-full rounded-lg border bg-transparent p-2 text-sm" />
              <input type="password" value={backendPassword} onChange={(event) => setBackendPassword(event.target.value)} placeholder={ui.password} className="w-full rounded-lg border bg-transparent p-2 text-sm" />
              <button disabled={gateBusy} className="w-full rounded-lg bg-blue-600 p-2.5 text-sm font-bold text-white"><LogIn className="mr-1 inline h-4 w-4" />{ui.login}</button>
            </form>
          )}
          {gateError && <p className="mt-3 flex items-center gap-1 text-xs text-rose-500"><AlertCircle className="h-4 w-4" />{gateError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100">
      {toast && <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl ${toast.type === 'error' ? 'bg-rose-100/90 text-rose-700' : 'bg-white/90 dark:bg-slate-900/90'}`}>{toast.text}</div>}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/60 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div><h1 className="font-black">{t.title}</h1><p className="text-[11px] text-slate-500">{t.subtitle}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(nextLanguage(lang))} className="rounded-lg border p-2"><Languages className="h-4 w-4" /></button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg border p-2">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {extensionMode && <button onClick={() => void clearLicense().then(() => setLicense(null))} className="rounded-lg border p-2" title={ui.logout}><LogOut className="h-4 w-4" /></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 lg:grid-cols-12 lg:p-8">
        <aside className="space-y-4 lg:col-span-3">
          {extensionMode && <button onClick={handleCapture} disabled={capturing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 text-xs font-bold text-white disabled:opacity-60">{capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{ui.bindCurrentAccount}</button>}
          <AccountPanel
            stats={stats}
            accounts={accounts}
            activeAccount={activeAccount}
            onSelectAccount={(account) => void handleSelectAccount(account)}
            onModifyPassword={() => notify(ui.passwordManaged, 'info')}
            onLogout={() => extensionMode && void clearLicense().then(() => setLicense(null))}
            onAdjustBalance={(balance) => {
              if (extensionMode) return notify(ui.realBalanceReadonly, 'info');
              const next = { ...stats, balance };
              setStats(next);
              localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(next));
            }}
            onAddNewAccount={(name) => {
              if (extensionMode) return notify(ui.useBindButton, 'info');
              const pddUserId = `preview_${Date.now()}`;
              const next = [...accounts, { id: `pdd_${pddUserId}`, pddUserId, name, avatar: '', bindTime: new Date().toLocaleString(), status: 'ACTIVE' as const }];
              setAccounts(next);
              localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(next));
            }}
            onDeleteAccount={(id) => void handleDeleteAccount(id)}
            lang={lang}
          />
        </aside>

        <section className="space-y-4 lg:col-span-9">
          <div className="rounded-2xl border border-white/30 bg-white/50 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black"><Filter className="h-4 w-4 text-blue-500" />{ui.orderFilters}</h2><button onClick={resetFilters} className="flex items-center gap-1 text-xs"><RotateCcw className="h-4 w-4" />{ui.reset}</button></div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="relative lg:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} className="w-full rounded-lg border bg-white/60 py-2.5 pl-10 pr-3 text-xs dark:bg-black/20" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="rounded-lg border bg-white/60 p-2 text-xs dark:bg-black/20"><option value="all">{t.allStatus}</option>{(['待支付', '待发货', '待收货', '已签收', '已退款', '已取消'] as const).map((value) => <option key={value} value={value}>{t[value]}</option>)}</select>
              <select value={recipient} onChange={(event) => setRecipient(event.target.value)} className="rounded-lg border bg-white/60 p-2 text-xs dark:bg-black/20"><option value={ALL_RECIPIENTS}>{t.allRecipients}</option>{recipients.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border bg-white/60 p-2 text-xs dark:bg-black/20" />
              <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border bg-white/60 p-2 text-xs dark:bg-black/20" />
              <div className="flex gap-1 lg:col-span-2">{[3, 7, 14, 30].map((days) => <button key={days} onClick={() => setPreset(days)} className="flex-1 rounded-lg border p-2 text-xs">{days}{ui.daySuffix}</button>)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/50 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <select value={accountScope} onChange={(event) => void handleScope(event.target.value as AccountScope)} className="rounded-lg border bg-transparent p-2 text-xs"><option value="active">{ui.currentAccount}</option><option value="all" disabled={extensionMode && !hasFeature(license, 'account.cross')}>{ui.allAccounts}</option></select>
              <span className="text-xs text-slate-500">{filteredOrders.length} {t.unit} · {new Set(filteredOrders.map((order) => order.recipientName)).size} {ui.recipientUnit}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {extensionMode && <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{ui.sync}</button>}
              <button onClick={() => setShowReconcile(true)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><CheckSquare className="h-4 w-4" />{ui.reconcile}</button>
              <button onClick={() => {
                if (!filteredOrders.length) return notify(ui.noExportOrders, 'error');
                downloadCsv(filteredOrders, lang, `dingduoduo_${startDate}_${endDate}.csv`);
              }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4" />CSV</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-900/50">
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={filteredOrders.length > 0 && filteredOrders.every((order) => order.selected)} onChange={(event) => toggleAll(event.target.checked)} />{ui.selectResults} ({selectedOrders.length})</label>
            <button onClick={handleRefund} disabled={refunding || !selectedOrders.length} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{refunding ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null} {ui.refund}</button>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => <OrderCard
              key={orderKey(order)}
              order={order}
              onSelect={(_id, selected) => toggleOrder(order, selected)}
              onRefreshLogistics={(id) => handlePreviewOnlyUpdate(id, 'logistics')}
              onOpenDetails={setSelectedDetails}
              onApplyInvoice={(id) => handlePreviewOnlyUpdate(id, 'invoice')}
              onReplayGroupBuy={() => notify(ui.reorderOnPdd, 'info')}
              onContactSupport={() => notify(cardUi.supportUnavailable, 'info')}
              onCopyText={(text, label) => void handleCopy(text, label)}
              lang={lang}
            />)}
            {!filteredOrders.length && <div className="rounded-2xl border border-white/30 bg-white/50 p-12 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/50">{t.noRecords}</div>}
          </div>
        </section>
      </main>

      <LogisticsModal order={selectedDetails} onClose={() => setSelectedDetails(null)} onCopyText={(text, label) => void handleCopy(text, label)} lang={lang} />
      <ReconciliationModal open={showReconcile} onClose={() => setShowReconcile(false)} lang={lang} fallbackOrders={orders} />
    </div>
  );
}
